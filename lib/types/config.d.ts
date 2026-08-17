import z from '@deepseek-ai/schemastery';
import { type ResolvedRetryPolicy, type RetryPolicyConfig } from '@deepseek-ai/dsh-llm';
import { type ModelEntry } from './constants.js';
export declare const NS: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export declare const DEFAULT_MAX_TOKENS = 65536;
export declare const DEFAULT_CONTEXT_WINDOW = 393216;
export declare const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000;
export declare const DEFAULT_TOKEN_FILE = "~/.config/manicode/credentials.json";
export declare const DEFAULT_TOKEN_ENV = "FREEBUFF_TOKEN";
export declare const Config: z<Schemastery.ObjectS<{
    /** Explicit freebuff auth tokens (one per account). Empty = auto-resolve. */
    accounts: z<({
        token?: string | null | undefined;
        email?: string | null | undefined;
        name?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        token: z<string, string>;
        email: z<string, string>;
        name: z<string, string>;
    }>[]>;
    /** Env var holding comma-separated tokens, consulted after `accounts`. */
    tokenEnv: z<string, string>;
    /** JSON credential file (official CLI layout), consulted last. */
    tokenFile: z<string, string>;
    baseURL: z<string, string>;
    /** http(s) proxy for upstream traffic; empty = HTTPS_PROXY/http_proxy env. */
    upstreamProxy: z<string, string>;
    models: z<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        description?: string | null | undefined;
        upstream?: string | null | undefined;
        session?: string | null | undefined;
        agent?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        name: z<string, string>;
        description: z<string, string>;
        upstream: z<string, string>;
        session: z<string, string>;
        agent: z<string, string>;
        contextWindow: z<number, number>;
        maxTokens: z<number, number>;
    }>[]>;
    maxTokens: z<number, number>;
    defaultContextWindow: z<number, number>;
    streamIdleTimeoutMs: z<number, number>;
    reasoningEffort: z<"low" | "high" | "max", "low" | "high" | "max">;
    retryPolicy: z<RetryPolicyConfig>;
}>, Schemastery.ObjectT<{
    /** Explicit freebuff auth tokens (one per account). Empty = auto-resolve. */
    accounts: z<({
        token?: string | null | undefined;
        email?: string | null | undefined;
        name?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        token: z<string, string>;
        email: z<string, string>;
        name: z<string, string>;
    }>[]>;
    /** Env var holding comma-separated tokens, consulted after `accounts`. */
    tokenEnv: z<string, string>;
    /** JSON credential file (official CLI layout), consulted last. */
    tokenFile: z<string, string>;
    baseURL: z<string, string>;
    /** http(s) proxy for upstream traffic; empty = HTTPS_PROXY/http_proxy env. */
    upstreamProxy: z<string, string>;
    models: z<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        description?: string | null | undefined;
        upstream?: string | null | undefined;
        session?: string | null | undefined;
        agent?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        name: z<string, string>;
        description: z<string, string>;
        upstream: z<string, string>;
        session: z<string, string>;
        agent: z<string, string>;
        contextWindow: z<number, number>;
        maxTokens: z<number, number>;
    }>[]>;
    maxTokens: z<number, number>;
    defaultContextWindow: z<number, number>;
    streamIdleTimeoutMs: z<number, number>;
    reasoningEffort: z<"low" | "high" | "max", "low" | "high" | "max">;
    retryPolicy: z<RetryPolicyConfig>;
}>>;
export interface ResolvedOptions {
    accounts: {
        token: string;
        email?: string;
        name?: string;
    }[];
    tokenEnv: string;
    tokenFile: string;
    baseURL: string;
    upstreamProxy: string;
    models: ModelEntry[];
    maxTokens: number;
    defaultContextWindow: number;
    streamIdleTimeoutMs: number;
    reasoningEffort: 'low' | 'high' | 'max';
    retryPolicy: ResolvedRetryPolicy;
}
export declare function resolveAdapterOptions(config: unknown): ResolvedOptions;
