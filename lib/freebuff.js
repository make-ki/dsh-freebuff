/**
 * FreebuffClient — the wire protocol of the freebuff desktop/CLI client,
 * reconstructed from the official source and the community freebuff2api
 * worker (protocol facts only; see docs/调研报告.md).
 *
 * Responsibilities:
 *   - global serial queue with a small gap (the free channel degrades when
 *     more than one upstream call is in flight)
 *   - per-account chat lock (one account = one live instance)
 *   - session lifecycle (GET reuse / POST create / queued polling / DELETE),
 *     run-chain lifecycle (root + context-pruner, cached), client behavior
 *     chain (ads + usage, throttled), account cooldown + round-robin
 */
import { randomUUID } from 'node:crypto';
import { collectText, request } from './tunnel.js';
import { parseSse } from './sse.js';
import { resolveProxyUrl } from './proxy-source.js';
import { CLI_UA, CONTEXT_PRUNER_AGENT } from './constants.js';
export class FreebuffUpstreamError extends Error {
    status;
    retryAfterMs;
    errorCode;
    constructor(message, status, retryAfterMs, errorCode) {
        super(message);
        this.status = status;
        this.retryAfterMs = retryAfterMs;
        this.errorCode = errorCode;
        this.name = 'FreebuffUpstreamError';
    }
}
const SESSION_TTL_MS = 59 * 60 * 1000; // session lasts ~1h; reuse while fresh
const RUN_TTL_MS = 10 * 60 * 1000; // run ids are only existence-checked
const BEHAVIOR_TTL_MS = 30 * 60 * 1000; // ads/usage throttle
const DEFAULT_SHORT_TIMEOUT_MS = 20_000;
const DEFAULT_QUEUE_GAP_MS = 300;
export function stableFingerprint(token) {
    // Deterministic per-account fingerprint (FNV-1a double-seed), mimicking the
    // official "enhanced-" prefix; the server keys identity on consistency.
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    const s = 'freebuff-fp-v2:' + token;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
    }
    return 'enhanced-' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
export class FreebuffClient {
    opts;
    chainTail = Promise.resolve();
    sessions = new Map();
    runs = new Map();
    behaviors = new Map();
    cooled = new Map();
    chatGates = new Map();
    rr = 0;
    proxyCache;
    proxyLogged = false;
    constructor(opts) {
        this.opts = opts;
    }
    // ── queue / locking ───────────────────────────────────────────────────────
    enqueue(fn) {
        const run = this.chainTail
            .then(() => sleep(this.opts.queueGapMs ?? DEFAULT_QUEUE_GAP_MS))
            .then(fn);
        this.chainTail = run.catch(() => { });
        return run;
    }
    /**
     * Serialize one account's whole request lifecycle: session acquisition +
     * run chain + chat stream must never overlap, because one account allows a
     * single live instance and a second session POST takes the first one over
     * (409 session_superseded). The caller holds the slot for the entire stream
     * and must release it in a finally block.
     */
    acquireAccountLock(token) {
        const prev = this.chatGates.get(token) ?? Promise.resolve();
        let release;
        const gate = new Promise((r) => {
            release = r;
        });
        this.chatGates.set(token, prev.then(() => gate));
        return { wait: prev, release };
    }
    // ── low-level HTTP ────────────────────────────────────────────────────────
    async resolveProxy() {
        const cached = this.proxyCache;
        if (cached && Date.now() - cached.at < 10_000)
            return cached.res;
        const res = await resolveProxyUrl(() => this.opts.proxyUrl());
        this.proxyCache = { at: Date.now(), res };
        return res;
    }
    async raw(method, path, opts) {
        const headers = { ...(opts.headers ?? {}) };
        if (opts.token)
            headers.Authorization = `Bearer ${opts.token}`;
        if (opts.body !== undefined)
            headers['Content-Type'] = 'application/json';
        const proxy = await this.resolveProxy();
        if (!this.proxyLogged) {
            this.proxyLogged = true;
            this.opts.logger?.warn?.(`llm-freebuff: upstream proxy source=${proxy.source} url=${proxy.url ?? '(direct)'}`);
        }
        return request(this.opts.baseURL() + path, {
            method,
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            timeoutMs: opts.timeoutMs ?? this.opts.shortTimeoutMs ?? DEFAULT_SHORT_TIMEOUT_MS,
            proxyUrl: proxy.url,
            signal: opts.signal,
        });
    }
    async json(method, path, opts) {
        return this.enqueue(async () => {
            const res = await this.raw(method, path, opts);
            const text = await collectText(res);
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            }
            catch {
                data = text;
            }
            return { status: res.statusCode ?? 0, data, text, headers: res.headers };
        });
    }
    // ── account pool ──────────────────────────────────────────────────────────
    /** Zero-quota health probe (GET /api/v1/me), used by the settings panel. */
    async probeMe(token) {
        const r = await this.json('GET', '/api/v1/me', { token, timeoutMs: 10_000 });
        return { status: r.status, data: r.data };
    }
    isCooled(token) {
        const until = this.cooled.get(token);
        return until !== undefined && Date.now() < until;
    }
    cooldown(token, ms) {
        this.cooled.set(token, Date.now() + Math.max(ms, 1000));
    }
    retryAfterMs(r) {
        const header = r.headers?.['retry-after'];
        if (typeof header === 'string' && /^\d+$/.test(header)) {
            const ms = Number(header) * 1000;
            if (Number.isFinite(ms) && ms > 0)
                return ms;
        }
        const data = r.data;
        if (data && typeof data.retryAfterMs === 'number' && data.retryAfterMs > 0)
            return data.retryAfterMs;
        return undefined;
    }
    observe(token, r) {
        if (r.status === 429)
            this.cooldown(token, this.retryAfterMs(r) ?? 60_000);
    }
    pickAccount(model, accounts) {
        const live = accounts.filter((a) => !this.isCooled(a.token));
        if (live.length === 0)
            return null;
        const reused = live.find((a) => this.usableSession(a.token, model));
        if (reused)
            return reused;
        const idx = this.rr++ % live.length;
        return live[idx];
    }
    usableSession(token, model) {
        const hit = this.sessions.get(token + ':' + model);
        return hit && Date.now() - hit.createdAt < SESSION_TTL_MS ? hit : undefined;
    }
    // ── client behavior chain (ads + usage, throttled, failures silent) ──────
    behaviorDue(key) {
        const ts = this.behaviors.get(key) ?? 0;
        if (Date.now() - ts > BEHAVIOR_TTL_MS) {
            this.behaviors.set(key, Date.now());
            return true;
        }
        return false;
    }
    osName() {
        switch (process.platform) {
            case 'win32':
                return 'windows';
            case 'darwin':
                return 'macos';
            default:
                return 'linux';
        }
    }
    async runBehavior(token) {
        const fingerprintId = stableFingerprint(token);
        const uaHeaders = { 'User-Agent': CLI_UA };
        if (this.behaviorDue('ads:' + token)) {
            try {
                const ad = await this.json('POST', '/api/v1/ads', {
                    token,
                    headers: uaHeaders,
                    timeoutMs: 6000,
                    body: {
                        provider: 'gravity',
                        sessionId: randomUUID(),
                        surface: 'waiting_room',
                        device: {
                            os: this.osName(),
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
                            locale: 'zh-CN',
                        },
                        userAgent: CLI_UA,
                    },
                });
                const ads = ad.data?.ads;
                const impUrl = Array.isArray(ads) && ads[0]?.impUrl;
                if (ad.status === 200 && impUrl) {
                    await this.json('POST', '/api/v1/ads/impression', {
                        token,
                        headers: uaHeaders,
                        timeoutMs: 6000,
                        body: { impUrl, mode: 'free' },
                    });
                }
            }
            catch {
                // silent
            }
        }
        if (this.behaviorDue('usage:' + token)) {
            try {
                await this.json('POST', '/api/v1/usage', {
                    token,
                    timeoutMs: 6000,
                    body: { fingerprintId },
                });
            }
            catch {
                // silent
            }
        }
    }
    // ── session lifecycle ─────────────────────────────────────────────────────
    async getSession(token, model, force = false) {
        const key = token + ':' + model;
        if (!force) {
            const cached = this.usableSession(token, model);
            if (cached)
                return cached;
            this.sessions.delete(key);
        }
        await this.runBehavior(token);
        if (!force) {
            const cur = await this.json('GET', '/api/v1/freebuff/session', {
                token,
                headers: { 'x-freebuff-include-unused-rate-limits': '1' },
                timeoutMs: 10_000,
            });
            this.observe(token, cur);
            const data = cur.data;
            if (cur.status === 200 && data?.status === 'active' && data.instanceId) {
                if (!data.model || data.model === model) {
                    const s = { instanceId: data.instanceId, model, createdAt: Date.now() };
                    this.sessions.set(key, s);
                    return s;
                }
                await this.deleteSession(token, data.instanceId).catch(() => { });
            }
        }
        const instId = randomUUID();
        const r = await this.json('POST', '/api/v1/freebuff/session', {
            token,
            headers: { 'x-freebuff-model': model, 'x-freebuff-instance-id': instId },
            timeoutMs: 10_000,
        });
        this.observe(token, r);
        const rd = r.data;
        if (r.status === 200 && rd?.status === 'active' && rd.instanceId) {
            const s = { instanceId: rd.instanceId, model, createdAt: Date.now() };
            this.sessions.set(key, s);
            return s;
        }
        if (r.status === 200 && rd?.status === 'queued' && rd.instanceId) {
            for (let i = 0; i < 8; i++) {
                await sleep(1500);
                const q = await this.json('GET', '/api/v1/freebuff/session', {
                    token,
                    headers: { 'x-freebuff-instance-id': rd.instanceId },
                    timeoutMs: 10_000,
                });
                this.observe(token, q);
                const qd = q.data;
                if (q.status === 200 && qd?.status === 'active' && qd.instanceId) {
                    const s = { instanceId: qd.instanceId, model, createdAt: Date.now() };
                    this.sessions.set(key, s);
                    return s;
                }
            }
            throw new FreebuffUpstreamError('session stayed queued (retry later)', 202);
        }
        if (r.status === 409) {
            throw new FreebuffUpstreamError('session_model_mismatch: ' + String(r.data?.message ?? 'upstream rejected this model'), 409);
        }
        throw new FreebuffUpstreamError('create session failed: ' + r.status + ' ' + r.text.slice(0, 300), r.status, this.retryAfterMs(r));
    }
    async deleteSession(token, instanceId) {
        await this.json('DELETE', '/api/v1/freebuff/session', {
            token,
            headers: { 'x-freebuff-instance-id': instanceId },
            timeoutMs: 10_000,
        });
    }
    // ── agent-run chain ───────────────────────────────────────────────────────
    async startRun(token, agentId, ancestors) {
        const r = await this.json('POST', '/api/v1/agent-runs', {
            token,
            timeoutMs: 10_000,
            body: { action: 'START', agentId, ancestorRunIds: ancestors },
        });
        if (r.status !== 200 || !r.data?.runId) {
            throw new FreebuffUpstreamError('start_run failed: ' + r.status + ' ' + r.text.slice(0, 200), r.status);
        }
        return r.data.runId;
    }
    async ensureRun(token, agentId) {
        const key = token + ':' + agentId;
        const hit = this.runs.get(key);
        if (hit && Date.now() - hit.createdAt < RUN_TTL_MS)
            return hit;
        const runId = await this.startRun(token, agentId, []);
        const childRunId = await this.startRun(token, CONTEXT_PRUNER_AGENT, [runId]);
        const run = { runId, childRunId, createdAt: Date.now() };
        this.runs.set(key, run);
        return run;
    }
    // ── chat stream ───────────────────────────────────────────────────────────
    /**
     * Recover from a taken-over session (409 session_superseded) WITHOUT
     * kicking the current occupant: GET the live session first and reuse it
     * when it is active for the same model; only create a fresh one otherwise.
     */
    async recoverSession(token, model) {
        const cur = await this.json('GET', '/api/v1/freebuff/session', {
            token,
            headers: { 'x-freebuff-include-unused-rate-limits': '1' },
            timeoutMs: 10_000,
        });
        this.observe(token, cur);
        const data = cur.data;
        if (cur.status === 200 && data?.status === 'active' && data.instanceId && (!data.model || data.model === model)) {
            const s = { instanceId: data.instanceId, model, createdAt: Date.now() };
            this.sessions.set(token + ':' + model, s);
            return s;
        }
        return this.getSession(token, model, true);
    }
    /**
     * POST one chat/completions and yield parsed SSE payloads (already
     * unwrapped), ending with the string '[DONE]'. The caller must hold the
     * account lock (acquireAccountLock) for the whole stream; stale sessions
     * (428 waiting_room_required / 409 session_superseded / 502 model
     * mismatch) are recovered once through `onStale(status)` and retried.
     * The stale session is NOT deleted: deleting a taken-over instance would
     * kick whatever client took it over, causing takeover loops.
     */
    async *chatStream(token, instanceId, payload, opts = {}) {
        let inst = instanceId;
        for (let attempt = 0; attempt < 2; attempt++) {
            const headers = {
                'Content-Type': 'application/json',
                'x-freebuff-instance-id': inst,
                accept: 'text/event-stream',
                ...(opts.extraHeaders ?? {}),
            };
            const res = await this.raw('POST', '/api/v1/chat/completions', {
                token,
                headers,
                body: payload,
                timeoutMs: 0,
                signal: opts.signal,
            });
            const status = res.statusCode ?? 0;
            if (status !== 200) {
                const text = await collectText(res);
                const stale = status === 428 ||
                    status === 409 ||
                    (status === 502 &&
                        (text.includes('session_model_mismatch') || text.includes('not valid for limited access')));
                if (stale && attempt === 0 && opts.onStale) {
                    inst = await opts.onStale(status);
                    continue;
                }
                throw new FreebuffUpstreamError('chat failed: ' + status + ' ' + text.slice(0, 300), status, this.retryAfterMs({ headers: res.headers, data: null }));
            }
            for await (const ev of parseSse(res)) {
                if (ev.data === '[DONE]') {
                    yield '[DONE]';
                    return;
                }
                let obj;
                try {
                    obj = JSON.parse(ev.data);
                }
                catch {
                    continue;
                }
                yield unwrapData(obj);
            }
            return;
        }
        throw new FreebuffUpstreamError('chat failed: session stayed stale after rebuild', 428);
    }
}
/** Some upstream wrappers nest the completion object under {data: …}. */
export function unwrapData(obj) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const d = obj.data;
        if (d && typeof d === 'object' && d.choices)
            return d;
    }
    return obj;
}
