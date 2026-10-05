import type { Context } from '@deepseek-ai/cordis';
import { Config, NS } from './config.js';
export declare const name = "llm-freebuff";
export declare const inject: string[];
export { Config, NS };
export { FreebuffAdapter } from './adapter.js';
export { FreebuffClient, stableFingerprint } from './freebuff.js';
export declare const PROVIDER = "freebuff";
export declare function apply(ctx: Context, config: unknown): void;
