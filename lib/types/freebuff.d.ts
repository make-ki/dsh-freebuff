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
    private acquireChatSlot;
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
     * POST one chat/completions and yield parsed SSE payloads (already
     * unwrapped), ending with the string '[DONE]'. Serialized per account;
     * stale sessions (428 waiting_room_required / 409 session_superseded /
     * 502 model mismatch) are rebuilt once through `onStale` and retried.
     */
    chatStream(token: string, instanceId: string, payload: unknown, opts?: {
        signal?: AbortSignal;
        extraHeaders?: Record<string, string>;
        /** Recreate the session (force) and return the new instance id. */
        onStale?: () => Promise<string>;
    }): AsyncGenerator<unknown>;
}
/** Some upstream wrappers nest the completion object under {data: …}. */
export declare function unwrapData(obj: unknown): unknown;
export {};
