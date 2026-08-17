import type { ResolvedOptions } from './config.js';
export interface FreebuffAccount {
    token: string;
    email?: string;
    name?: string;
    fingerprintId?: string;
}
export declare function expandHome(file: string): string;
export declare function resolveAccounts(options: ResolvedOptions): Promise<FreebuffAccount[]>;
