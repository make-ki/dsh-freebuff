import z from '@deepseek-ai/schemastery';
import { type ResolvedRetryPolicy, type RetryPolicyConfig } from '@deepseek-ai/dsh-llm';
import { type ModelEntry } from './constants.js';
export declare const NS = "llm-freebuff";
export declare const DEFAULT_MAX_TOKENS = 65536;
export declare const DEFAULT_CONTEXT_WINDOW = 393216;
export declare const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000;
export declare const DEFAULT_TOKEN_FILE = "~/.config/manicode/credentials.json";
export declare const DEFAULT_TOKEN_ENV = "FREEBUFF_TOKEN";
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    /** 凭证引用：在「设置 > 模型」的 Freebuff 卡片点「配置凭证」会写入此引用（默认 FREEBUFF_API_KEY）。 */
    apiKeyEnv: z<string, string, "volatile-defined">;
    /** 显式 token 列表（每项一个账号）。留空时按顺序尝试：凭证库 → FREEBUFF_TOKEN 环境变量 → 官方 CLI 凭证文件。 */
    accounts: z<NoInfer<({
        token?: string | null | undefined;
        email?: string | null | undefined;
        name?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[]>, NoInfer<Schemastery.ObjectT<NoInfer<{
        token: z<string, string, "defined">;
        email: z<string, string, "plain">;
        name: z<string, string, "plain">;
    }>>[]>, "volatile-defined">;
    tokenEnv: z<string, string, "volatile-defined">;
    tokenFile: z<string, string, "volatile-defined">;
    baseURL: z<string, string, "volatile-defined">;
    upstreamProxy: z<string, string, "volatile-defined">;
    reasoningEffort: z<"low" | "high" | "max", "low" | "high" | "max", "volatile-defined">;
    maxTokens: z<number, number, "volatile-defined">;
    defaultContextWindow: z<number, number, "volatile-defined">;
    streamIdleTimeoutMs: z<number, number, "volatile-defined">;
    models: z<NoInfer<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        description?: string | null | undefined;
        upstream?: string | null | undefined;
        session?: string | null | undefined;
        agent?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[]>, NoInfer<Schemastery.ObjectT<NoInfer<{
        id: z<string, string, "defined">;
        name: z<string, string, "defined">;
        description: z<string, string, "defined">;
        upstream: z<string, string, "defined">;
        session: z<string, string, "defined">;
        agent: z<string, string, "defined">;
        contextWindow: z<number, number, "defined">;
        maxTokens: z<number, number, "defined">;
    }>>[]>, "volatile-defined">;
    retryPolicy: z<NoInfer<RetryPolicyConfig>, NoInfer<RetryPolicyConfig>, "volatile">;
}>>, Schemastery.ObjectT<NoInfer<{
    /** 凭证引用：在「设置 > 模型」的 Freebuff 卡片点「配置凭证」会写入此引用（默认 FREEBUFF_API_KEY）。 */
    apiKeyEnv: z<string, string, "volatile-defined">;
    /** 显式 token 列表（每项一个账号）。留空时按顺序尝试：凭证库 → FREEBUFF_TOKEN 环境变量 → 官方 CLI 凭证文件。 */
    accounts: z<NoInfer<({
        token?: string | null | undefined;
        email?: string | null | undefined;
        name?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[]>, NoInfer<Schemastery.ObjectT<NoInfer<{
        token: z<string, string, "defined">;
        email: z<string, string, "plain">;
        name: z<string, string, "plain">;
    }>>[]>, "volatile-defined">;
    tokenEnv: z<string, string, "volatile-defined">;
    tokenFile: z<string, string, "volatile-defined">;
    baseURL: z<string, string, "volatile-defined">;
    upstreamProxy: z<string, string, "volatile-defined">;
    reasoningEffort: z<"low" | "high" | "max", "low" | "high" | "max", "volatile-defined">;
    maxTokens: z<number, number, "volatile-defined">;
    defaultContextWindow: z<number, number, "volatile-defined">;
    streamIdleTimeoutMs: z<number, number, "volatile-defined">;
    models: z<NoInfer<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        description?: string | null | undefined;
        upstream?: string | null | undefined;
        session?: string | null | undefined;
        agent?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[]>, NoInfer<Schemastery.ObjectT<NoInfer<{
        id: z<string, string, "defined">;
        name: z<string, string, "defined">;
        description: z<string, string, "defined">;
        upstream: z<string, string, "defined">;
        session: z<string, string, "defined">;
        agent: z<string, string, "defined">;
        contextWindow: z<number, number, "defined">;
        maxTokens: z<number, number, "defined">;
    }>>[]>, "volatile-defined">;
    retryPolicy: z<NoInfer<RetryPolicyConfig>, NoInfer<RetryPolicyConfig>, "volatile">;
}>>, "plain">;
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
export declare function plainOptions(config: unknown): Record<string, unknown>;
export declare function resolveAdapterOptions(config: unknown): ResolvedOptions;
