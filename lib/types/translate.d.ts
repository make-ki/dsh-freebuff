/**
 * Translate upstream freebuff SSE payloads (OpenAI chat-completions shaped,
 * optionally wrapped in {data: …}) into harness StreamChunks. Same protocol
 * mapping as the DeepSeek adapter: text / reasoning_content / tool_calls
 * deltas open stateful blocks; finish reason and usage are deferred until
 * the [DONE] sentinel.
 */
import { type StreamChunk } from '@deepseek-ai/dsh-llm';
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    reasoningTokens?: number;
}
interface Choice {
    delta?: {
        content?: string;
        reasoning_content?: string;
        tool_calls?: {
            index?: number;
            id?: string;
            function?: {
                name?: string;
                arguments?: string;
            };
        }[];
    };
    finish_reason?: string;
}
interface WireChunk {
    choices?: Choice[];
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: {
            cached_tokens?: number;
        };
        prompt_cache_hit_tokens?: number;
        completion_tokens_details?: {
            reasoning_tokens?: number;
        };
    };
}
export declare function mapUsage(usage: NonNullable<WireChunk['usage']>): TokenUsage;
/**
 * Consume parsed SSE payloads (ending with the string '[DONE]') and yield
 * harness StreamChunks. Malformed payloads abort with MALFORMED_RESPONSE; a
 * stream ending without [DONE] aborts with STREAM_CLOSED.
 */
export declare function translate(payloads: AsyncIterable<unknown>): AsyncGenerator<StreamChunk>;
export {};
