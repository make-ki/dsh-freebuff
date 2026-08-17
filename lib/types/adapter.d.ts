/**
 * FreebuffAdapter — registers the `freebuff` provider route on ctx.llm.
 * Mirrors the dsh-llm-deepseek adapter structure: serialize → wire → SSE →
 * StreamChunks, with the freebuff client owning the protocol lifecycle
 * (session/run/chat/queue/cooldown).
 */
import { LlmAdapter, type GenerateOptions, type LlmModelInfo, type LlmResolvedModelInfo, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { FreebuffClient } from './freebuff.js';
import type { ResolvedOptions } from './config.js';
export interface AdapterConfig {
    options: () => ResolvedOptions;
    client: FreebuffClient;
    userId: () => string;
    /**
     * Resolve the credential-store / env token value for `apiKeyEnv`
     * (the Models page "configure credential" button writes this ref).
     * May hold one token or comma-separated multiple accounts.
     */
    resolveApiKey: () => Promise<string | undefined>;
}
export declare class FreebuffAdapter extends LlmAdapter {
    private config;
    constructor(config: AdapterConfig);
    providerInfo(provider: string): {
        id: string;
        name: string;
    };
    providerRetryPolicy(_provider: string): ResolvedRetryPolicy | undefined;
    listModels(provider: string): Promise<LlmModelInfo[]>;
    resolveModel(provider: string, model: string, _signal: AbortSignal): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncGenerator<StreamChunk>;
    private request;
    private mapError;
}
