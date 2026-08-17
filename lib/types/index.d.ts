import { Config, NS } from './config.js';
export declare const name = "llm-freebuff";
export declare const inject: string[];
export { Config, NS };
export { FreebuffAdapter } from './adapter.js';
export { FreebuffClient, stableFingerprint } from './freebuff.js';
/** The single provider route this plugin owns. */
export declare const PROVIDER = "freebuff";
export declare function apply(ctx: import('@deepseek-ai/cordis').Context, config: unknown): void;
