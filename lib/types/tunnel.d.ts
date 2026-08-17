/**
 * Minimal proxy-aware HTTP(S) request helper for the freebuff upstream.
 * Supports direct https, plain-http via proxy, and https-over-http CONNECT
 * tunneling (the shape the official launcher uses). Node's global fetch does
 * not honor proxy env vars, so the wire layer talks node:http/https directly.
 */
import http from 'node:http';
export interface RequestInit {
    method: string;
    headers: Record<string, string>;
    body?: string | Buffer;
    /** 0 / undefined = no overall timeout (streaming calls). */
    timeoutMs?: number;
    proxyUrl?: string;
    signal?: AbortSignal;
}
declare function isAbort(error: unknown): boolean;
/**
 * Issue one request to `targetUrl` and resolve with the response stream.
 * Rejects with an `AbortError`-named error on signal abort.
 */
export declare function request(targetUrl: string, options: RequestInit): Promise<http.IncomingMessage>;
/** Collect a response body into a string (for short JSON exchanges). */
export declare function collectText(res: http.IncomingMessage): Promise<string>;
export { isAbort };
