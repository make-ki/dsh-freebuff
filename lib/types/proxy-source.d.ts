/** Parse a Windows Internet Settings ProxyServer value into per-scheme entries. */
export declare function parseProxyServer(raw: string): {
    http: string;
    https: string;
};
/** Detect the Windows system proxy; returns a normalized CONNECT URL or undefined. */
export declare function detectWindowsSystemProxy(): Promise<string | undefined>;
export interface ProxyResolution {
    url: string | undefined;
    /** Diagnostic description of where the proxy came from. */
    source: 'manual' | 'dsh-env' | 'registry' | 'env' | 'none';
}
export declare function resolveProxyUrl(manualOverride: () => string | undefined): Promise<ProxyResolution>;
