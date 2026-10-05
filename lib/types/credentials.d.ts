import type { ResolvedOptions } from './config.js';
export interface FreebuffAccount {
    token: string;
    email?: string;
    name?: string;
    fingerprintId?: string;
}
export declare function resolveEffectiveAccounts(options: ResolvedOptions, resolveApiKey: () => Promise<string | undefined>): Promise<FreebuffAccount[]>;
export declare function expandHome(file: string): string;
export declare function resolveAccounts(options: ResolvedOptions): Promise<FreebuffAccount[]>;
