/**
 * Minimal proxy-aware HTTP(S) request helper for the freebuff upstream.
 * Supports direct https, plain-http via proxy, and https-over-http CONNECT
 * tunneling (the shape the official launcher uses). Node's global fetch does
 * not honor proxy env vars, so the wire layer talks node:http/https directly.
 */
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
function isAbort(error) {
    return error instanceof Error && error.name === 'AbortError';
}
/**
 * Issue one request to `targetUrl` and resolve with the response stream.
 * Rejects with an `AbortError`-named error on signal abort.
 */
export function request(targetUrl, options) {
    return new Promise((resolve, reject) => {
        const u = new URL(targetUrl);
        const isHttps = u.protocol === 'https:';
        const transport = isHttps ? https : http;
        const baseOptions = {
            method: options.method,
            headers: options.headers,
        };
        const cleanupSignal = () => options.signal?.removeEventListener('abort', onAbort);
        const onAbort = () => {
            try {
                activeReq?.destroy();
            }
            catch { /* already dead */ }
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        };
        if (options.signal?.aborted) {
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
            return;
        }
        let activeReq;
        const proxyUrl = options.proxyUrl;
        const useProxy = Boolean(proxyUrl) && !LOCAL_HOSTS.has(u.hostname);
        let started = false;
        const finish = (res) => {
            if (started)
                return;
            started = true;
            cleanupSignal();
            resolve(res);
        };
        const fail = (error) => {
            if (started)
                return;
            started = true;
            cleanupSignal();
            reject(error);
        };
        const send = () => {
            if (options.signal)
                options.signal.addEventListener('abort', onAbort);
            if (options.timeoutMs) {
                activeReq?.setTimeout(options.timeoutMs, () => {
                    activeReq?.destroy(Object.assign(new Error('Request timeout'), { name: 'TimeoutError' }));
                });
            }
            activeReq?.on('response', finish);
            activeReq?.on('error', fail);
            if (options.body !== undefined)
                activeReq?.write(options.body);
            activeReq?.end();
        };
        if (useProxy && isHttps) {
            const p = new URL(proxyUrl);
            const connectReq = http.request({
                hostname: p.hostname,
                port: p.port ? Number(p.port) : 80,
                method: 'CONNECT',
                path: `${u.hostname}:${u.port || 443}`,
                headers: {
                    Host: `${u.hostname}:${u.port || 443}`,
                    ...(p.username
                        ? { 'Proxy-Authorization': 'Basic ' + Buffer.from(`${decodeURIComponent(p.username)}:${decodeURIComponent(p.password || '')}`).toString('base64') }
                        : {}),
                },
            });
            connectReq.on('connect', (res, socket) => {
                if (res.statusCode !== 200) {
                    socket.destroy();
                    fail(new Error(`Proxy CONNECT failed with status ${res.statusCode}`));
                    return;
                }
                const secure = tls.connect({ socket, servername: u.hostname });
                activeReq = https.request({
                    ...baseOptions,
                    hostname: u.hostname,
                    port: u.port ? Number(u.port) : 443,
                    path: u.pathname + u.search,
                    createConnection: () => secure,
                    agent: false,
                });
                send();
            });
            connectReq.on('error', fail);
            connectReq.end();
        }
        else if (useProxy) {
            const p = new URL(proxyUrl);
            activeReq = http.request({
                ...baseOptions,
                hostname: p.hostname,
                port: p.port ? Number(p.port) : 80,
                path: u.href,
                headers: { ...options.headers, Host: u.host },
            });
            send();
        }
        else {
            activeReq = transport.request({
                ...baseOptions,
                hostname: u.hostname,
                port: u.port ? Number(u.port) : isHttps ? 443 : 80,
                path: u.pathname + u.search,
            });
            send();
        }
    });
}
/** Collect a response body into a string (for short JSON exchanges). */
export async function collectText(res) {
    const chunks = [];
    for await (const chunk of res)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
}
export { isAbort };
