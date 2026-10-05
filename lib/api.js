import { resolveEffectiveAccounts } from './credentials.js';
import { resolveProxyUrl } from './proxy-source.js';
function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(text);
}
async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.trim() === '')
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
function mask(token) {
    return token.length <= 8 ? '••••' : token.slice(0, 4) + '••••' + token.slice(-4);
}
export function installFreebuffApi(ctx, deps) {
    const webserver = ctx.get('webServer');
    if (webserver === undefined) {
        ctx.logger?.warn?.('llm-freebuff: webServer service not available; settings API disabled');
        return;
    }
    const dispose = webserver.register({
        kind: 'prefix',
        path: '/freebuff/api',
        handler: async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://local');
            const path = url.pathname.replace(/^\/freebuff\/api/, '') || '/';
            try {
                if (req.method === 'GET' && path === '/status') {
                    const options = deps.options();
                    const accounts = await resolveEffectiveAccounts(options, deps.resolveApiKey);
                    const proxy = await resolveProxyUrl(() => (options.upstreamProxy.length > 0 ? options.upstreamProxy : undefined));
                    return sendJson(res, 200, {
                        ok: true,
                        apiKeyEnv: options.apiKeyEnv,
                        baseURL: options.baseURL,
                        proxy: { source: proxy.source, url: proxy.url ?? null },
                        credentialConfigured: await deps.credentialConfigured(),
                        accounts: accounts.map((a) => ({ email: a.email ?? null, token: mask(a.token) })),
                        models: options.models.map((m) => ({ id: m.id, name: m.name })),
                    });
                }
                if (req.method === 'POST' && path === '/credentials') {
                    const body = (await readJsonBody(req));
                    const value = typeof body?.value === 'string' ? body.value.trim() : '';
                    if (value.length === 0)
                        return sendJson(res, 400, { ok: false, error: 'empty credential value' });
                    if (deps.credentials === undefined)
                        return sendJson(res, 503, { ok: false, error: 'credentials service unavailable' });
                    await deps.credentials.set(deps.options().apiKeyEnv, value);
                    return sendJson(res, 200, { ok: true });
                }
                if (req.method === 'POST' && path === '/credentials/clear') {
                    if (deps.credentials === undefined)
                        return sendJson(res, 503, { ok: false, error: 'credentials service unavailable' });
                    await deps.credentials.unset(deps.options().apiKeyEnv);
                    return sendJson(res, 200, { ok: true });
                }
                if (req.method === 'POST' && path === '/probe') {
                    const options = deps.options();
                    const accounts = await resolveEffectiveAccounts(options, deps.resolveApiKey);
                    if (accounts.length === 0)
                        return sendJson(res, 200, { ok: false, error: 'no account configured' });
                    const first = accounts[0];
                    const result = await deps.probe(first.token);
                    const data = result.data;
                    return sendJson(res, 200, {
                        ok: result.status === 200,
                        status: result.status,
                        uid: data?.uid ?? null,
                        accountStatus: data?.status ?? null,
                        message: data?.message ?? null,
                    });
                }
                return sendJson(res, 404, { ok: false, error: 'not found' });
            }
            catch (error) {
                ctx.logger?.warn?.('llm-freebuff: api error: ' + String(error instanceof Error ? error.message : error));
                return sendJson(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) });
            }
        },
    });
    ctx.effect(() => dispose, 'dsh-freebuff: webserver api');
}
