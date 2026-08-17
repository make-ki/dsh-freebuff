/**
 * Upstream proxy resolution for the freebuff provider, in precedence order:
 *   1. `upstreamProxy` from plugin settings
 *   2. harness-managed `DSH_PROXY_HTTPS` / `DSH_PROXY_HTTP` vars
 *   3. the Windows system proxy (HKCU Internet Settings registry, the same
 *      source dsh-auto-proxy trusts) — the host process env often carries
 *      stale HTTPS_PROXY leftovers, so the registry outranks plain env vars
 *   4. generic HTTPS_PROXY / HTTP_PROXY env vars (last resort)
 * The result is normalized to an `http://` CONNECT-tunnel URL.
 */
import { execFile } from 'node:child_process';
function toHttpTunnelUrl(raw, defaultPort) {
    const value = raw.trim();
    if (value === '')
        return '';
    if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        return `http://${url.hostname}${url.port !== '' ? `:${url.port}` : ''}`;
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value))
        return value;
    const hasPort = /:\d+$/.test(value);
    return `http://${value}${hasPort ? '' : `:${defaultPort}`}`;
}
/** Parse a Windows Internet Settings ProxyServer value into per-scheme entries. */
export function parseProxyServer(raw) {
    const parts = raw.split(';').map((p) => p.trim()).filter(Boolean);
    let http = '';
    let https = '';
    for (const part of parts) {
        const eq = part.indexOf('=');
        if (eq === -1) {
            if (http === '')
                http = part;
            if (https === '')
                https = part;
            continue;
        }
        const scheme = part.slice(0, eq).toLowerCase();
        const target = part.slice(eq + 1).trim();
        if (target === '')
            continue;
        if (scheme === 'http')
            http = target;
        else if (scheme === 'https')
            https = target;
    }
    return { http, https };
}
function readRegistryValue(name) {
    return new Promise((resolve) => {
        const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
        execFile('reg', ['query', key, '/v', name], { timeout: 3000, windowsHide: true }, (error, stdout) => {
            if (error)
                return resolve('');
            for (const line of stdout.split(/\r?\n/)) {
                if (!line.includes('REG_'))
                    continue;
                const tokens = line.trim().split(/\s+/);
                const value = tokens[tokens.length - 1] ?? '';
                if (value !== '')
                    return resolve(value);
            }
            resolve('');
        });
    });
}
/** Detect the Windows system proxy; returns a normalized CONNECT URL or undefined. */
export async function detectWindowsSystemProxy() {
    if (process.platform !== 'win32')
        return undefined;
    const [enable, server] = await Promise.all([readRegistryValue('ProxyEnable'), readRegistryValue('ProxyServer')]);
    if (enable !== '0x1' || server === '')
        return undefined;
    const { http, https } = parseProxyServer(server);
    const entry = https !== '' ? https : http;
    if (entry === '')
        return undefined;
    return toHttpTunnelUrl(entry, 443);
}
export async function resolveProxyUrl(manualOverride) {
    const manual = manualOverride();
    if (manual && manual.trim() !== '')
        return { url: toHttpTunnelUrl(manual.trim(), 443), source: 'manual' };
    const dshVar = process.env.DSH_PROXY_HTTPS || process.env.DSH_PROXY_HTTP;
    if (dshVar && dshVar.trim() !== '')
        return { url: toHttpTunnelUrl(dshVar.trim(), 443), source: 'dsh-env' };
    const fromRegistry = await detectWindowsSystemProxy();
    if (fromRegistry !== undefined)
        return { url: fromRegistry, source: 'registry' };
    const envVar = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    if (envVar && envVar.trim() !== '')
        return { url: toHttpTunnelUrl(envVar.trim(), 443), source: 'env' };
    return { url: undefined, source: 'none' };
}
