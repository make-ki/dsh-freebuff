import type { FreebuffAccount } from './credentials.js';
export interface SessionCache {
    instanceId: string;
    model: string;
    createdAt: number;
}
export interface RunCache {
    runId: string;
    childRunId: string;
    createdAt: number;
}
export declare class FreebuffUpstreamError extends Error {
    readonly status: number;
    readonly retryAfterMs?: number | undefined;
    readonly errorCode?: string | undefined;
    constructor(message: string, status: number, retryAfterMs?: number | undefined, errorCode?: string | undefined);
}
interface ClientOptions {
    baseURL: () => string;
    proxyUrl: () => string | undefined;
    logger?: {
        warn?: (msg: string) => void;
        info?: (msg: string) => void;
    };
    shortTimeoutMs?: number;
    queueGapMs?: number;
}
export declare function stableFingerprint(token: string): string;
export declare class FreebuffClient {
    private opts;
    private chainTail;
    private sessions;
    private runs;
    private behaviors;
    private cooled;
    private chatGates;
    private rr;
    private proxyCache;
    private proxyLogged;
    constructor(opts: ClientOptions);
    private enqueue;
    /**
     * Serialize one account's whole request lifecycle: session acquisition +
     * run chain + chat stream must never overlap, because one account allows a
     * single live instance and a second session POST takes the first one over
     * (409 session_superseded). The caller holds the slot for the entire stream
     * and must release it in a finally block.
     */
    acquireAccountLock(token: string): {
        wait: Promise<void>;
        release: () => void;
    };
    private resolveProxy;
    private raw;
    private json;
    isCooled(token: string): boolean;
    cooldown(token: string, ms: number): void;
    private retryAfterMs;
    private observe;
    pickAccount(model: string, accounts: FreebuffAccount[]): FreebuffAccount | null;
    usableSession(token: string, model: string): SessionCache | undefined;
    private behaviorDue;
    private osName;
    private runBehavior;
    getSession(token: string, model: string, force?: boolean): Promise<SessionCache>;
    deleteSession(token: string, instanceId: string): Promise<void>;
    private startRun;
    ensureRun(token: string, agentId: string): Promise<RunCache>;
    /**
     * Recover from a taken-over session (409 session_superseded) WITHOUT
     * kicking the current occupant: GET the live session first and reuse it
     * when it is active for the same model; only create a fresh one otherwise.
     */
    recoverSession(token: string, model: string): Promise<SessionCache>;
    /**
     * POST one chat/completions and yield parsed SSE payloads (already
     * unwrapped), ending with the string '[DONE]'. The caller must hold the
     * account lock (acquireAccountLock) for the whole stream; stale sessions
     * (428 waiting_room_required / 409 session_superseded / 502 model
     * mismatch) are recovered once through `onStale(status)` and retried.
     * The stale session is NOT deleted: deleting a taken-over instance would
     * kick whatever client took it over, causing takeover loops.
     */
    chatStream(token: string, instanceId: string, payload: unknown, opts?: {
        signal?: AbortSignal;
        extraHeaders?: Record<string, string>;
        /** Recover the session and return the new instance id. */
        onStale?: (status: number) => Promise<string>;
    }): AsyncGenerator<unknown>;
}
/** Some upstream wrappers nest the completion object under {data: …}. */
export declare function unwrapData(obj: unknown): unknown;
export {};
