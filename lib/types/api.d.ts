import type { Context } from '@deepseek-ai/cordis';
import type { ResolvedOptions } from './config.js';
export interface ApiDeps {
    options: () => ResolvedOptions;
    credentials: {
        set: (ref: string, value: string) => Promise<unknown>;
        unset: (ref: string) => Promise<unknown>;
    } | undefined;
    credentialConfigured: () => Promise<boolean>;
    resolveApiKey: () => Promise<string | undefined>;
    /** Raw upstream GET helper for the probe (0-quota /api/v1/me). */
    probe: (token: string) => Promise<{
        status: number;
        data: unknown;
    }>;
}
export declare function installFreebuffApi(ctx: Context, deps: ApiDeps): void;
