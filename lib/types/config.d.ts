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
    /** 凭证引用：在「设置 > 模型」的 Freebuff 卡片点「配置凭证」会写入此引用（默认 FREEBUFF_API_KEY）。 */
    apiKeyEnv: z<string, string>;
    /** 显式 token 列表（每项一个账号）。留空时按顺序尝试：凭证库 → FREEBUFF_TOKEN 环境变量 → 官方 CLI 凭证文件。 */
    accounts: z<({
        token?: string | null | undefined;
        email?: string | null | undefined;
        name?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        token: z<string, string>;
        email: z<string, string>;
        name: z<string, string>;
    }>[]>;
    tokenEnv: z<string, string>;
    tokenFile: z<string, string>;
    baseURL: z<string, string>;
    upstreamProxy: z<string, string>;
    reasoningEffort: z<"low" | "high" | "max", "low" | "high" | "max">;
    maxTokens: z<number, number>;
    defaultContextWindow: z<number, number>;
    streamIdleTimeoutMs: z<number, number>;
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
    retryPolicy: z<RetryPolicyConfig>;
}>, Schemastery.ObjectT<{
    /** 凭证引用：在「设置 > 模型」的 Freebuff 卡片点「配置凭证」会写入此引用（默认 FREEBUFF_API_KEY）。 */
    apiKeyEnv: z<string, string>;
    /** 显式 token 列表（每项一个账号）。留空时按顺序尝试：凭证库 → FREEBUFF_TOKEN 环境变量 → 官方 CLI 凭证文件。 */
    accounts: z<({
        token?: string | null | undefined;
        email?: string | null | undefined;
        name?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        token: z<string, string>;
        email: z<string, string>;
        name: z<string, string>;
    }>[]>;
    tokenEnv: z<string, string>;
    tokenFile: z<string, string>;
    baseURL: z<string, string>;
    upstreamProxy: z<string, string>;
    reasoningEffort: z<"low" | "high" | "max", "low" | "high" | "max">;
    maxTokens: z<number, number>;
    defaultContextWindow: z<number, number>;
    streamIdleTimeoutMs: z<number, number>;
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
    retryPolicy: z<RetryPolicyConfig>;
}>>;
export interface ResolvedOptions {
    apiKeyEnv: string;
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
