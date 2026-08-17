/**
 * Freebuff protocol constants, verified against the official freebuff
 * source (common/src/constants/*) and the community freebuff2api worker
 * (2026-08). Protocol facts only — no code is copied from either project.
 */
/** Official free-mode marker: the first system message must start with this
 * byte-for-byte (server `hasFreebuffRootSystemPromptOpening` check). */
export declare const BUFFY = "You are Buffy, the strategic coding assistant.";
/** Agent run started as the child of the root run; chat validates run ids. */
export declare const CONTEXT_PRUNER_AGENT = "context-pruner";
/** Free-mode stop sequence (common/src/tools/constants.ts `endsAgentStepParam`). */
export declare const CB_EASP = "\"cb_easp\"";
/** Client UA used by the official CLI on the ad endpoints. */
export declare const CLI_UA = "Freebuff-CLI/0.0.138";
/** Default upstream base URL (NEXT_PUBLIC_CODEBUFF_APP_URL). */
export declare const DEFAULT_BASE_URL = "https://www.codebuff.com";
/** Stable fingerprint prefix used by official clients. */
export declare const FINGERPRINT_PREFIX = "enhanced-";
/** Upstream payload keys passed through from the harness request. */
export declare const UPSTREAM_KEYS: readonly ["frequency_penalty", "logit_bias", "logprobs", "max_completion_tokens", "max_tokens", "metadata", "modalities", "parallel_tool_calls", "presence_penalty", "reasoning_effort", "response_format", "seed", "service_tier", "stop", "store", "stream_options", "temperature", "tool_choice", "tools", "top_logprobs", "top_p", "top_k", "user"];
/** Official reasoning-effort ladder, ascending. */
export declare const REASONING_EFFORT_RANK: readonly ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
/** Per-model user-selectable effort ladders (official model table). */
export declare const MODEL_EFFORTS: Record<string, string[]>;
export interface ModelEntry {
    /** Harness-facing model id (also the upstream session/model id). */
    id: string;
    name: string;
    description: string;
    /** Upstream model id sent in the chat payload. */
    upstream: string;
    /** Session model id sent in the `x-freebuff-model` header. */
    session: string;
    /** Root agent id started via /api/v1/agent-runs. */
    agent: string;
    contextWindow: number;
    maxTokens: number;
}
/** Default catalog (official FREEBUFF_MODEL_TO_AGENT_ID mapping, 2026-08). */
export declare const DEFAULT_MODELS: ModelEntry[];
