/**
 * Freebuff protocol constants, verified against the official freebuff
 * source (common/src/constants/*) and the community freebuff2api worker
 * (2026-08). Protocol facts only — no code is copied from either project.
 */
/** Official free-mode marker: the first system message must start with this
 * byte-for-byte (server `hasFreebuffRootSystemPromptOpening` check). */
export const BUFFY = 'You are Buffy, the strategic coding assistant.';
/** Agent run started as the child of the root run; chat validates run ids. */
export const CONTEXT_PRUNER_AGENT = 'context-pruner';
/** Free-mode stop sequence (common/src/tools/constants.ts `endsAgentStepParam`). */
export const CB_EASP = '"cb_easp"';
/** Client UA used by the official CLI on the ad endpoints. */
export const CLI_UA = 'Freebuff-CLI/0.0.138';
/** Default upstream base URL (NEXT_PUBLIC_CODEBUFF_APP_URL). */
export const DEFAULT_BASE_URL = 'https://www.codebuff.com';
/** Stable fingerprint prefix used by official clients. */
export const FINGERPRINT_PREFIX = 'enhanced-';
/** Upstream payload keys passed through from the harness request. */
export const UPSTREAM_KEYS = [
    'frequency_penalty',
    'logit_bias',
    'logprobs',
    'max_completion_tokens',
    'max_tokens',
    'metadata',
    'modalities',
    'parallel_tool_calls',
    'presence_penalty',
    'reasoning_effort',
    'response_format',
    'seed',
    'service_tier',
    'stop',
    'store',
    'stream_options',
    'temperature',
    'tool_choice',
    'tools',
    'top_logprobs',
    'top_p',
    'top_k',
    'user',
];
/** Official reasoning-effort ladder, ascending. */
export const REASONING_EFFORT_RANK = [
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'max',
    'ultra',
];
/** Per-model user-selectable effort ladders (official model table). */
export const MODEL_EFFORTS = {
    'deepseek/deepseek-v4-flash': ['low', 'high', 'max'],
    'deepseek/deepseek-v4-pro': ['high', 'max'],
    'openai/gpt-5.6-luna': ['low', 'medium', 'high', 'max'],
    'meta/muse-spark-1.2-contributor': ['low', 'medium', 'high', 'xhigh'],
};
/** Default catalog (official FREEBUFF_MODEL_TO_AGENT_ID mapping, 2026-08). */
export const DEFAULT_MODELS = [
    {
        id: 'deepseek/deepseek-v4-flash',
        name: 'Freebuff DeepSeek V4 Flash',
        description: 'DeepSeek V4 Flash via freebuff (free tier, session quota)',
        upstream: 'deepseek/deepseek-v4-flash',
        session: 'deepseek/deepseek-v4-flash',
        agent: 'base2-free-deepseek-flash',
        contextWindow: 393216,
        maxTokens: 65536,
    },
    {
        id: 'deepseek/deepseek-v4-pro',
        name: 'Freebuff DeepSeek V4 Pro',
        description: 'DeepSeek V4 Pro via freebuff (premium pool, 6 sessions/day)',
        upstream: 'deepseek/deepseek-v4-pro',
        session: 'deepseek/deepseek-v4-pro',
        agent: 'base2-free-deepseek',
        contextWindow: 393216,
        maxTokens: 65536,
    },
    {
        id: 'minimax/minimax-m3',
        name: 'Freebuff MiniMax M3',
        description: 'MiniMax M3 via freebuff (premium pool, 6 sessions/day)',
        upstream: 'minimax/minimax-m3',
        session: 'minimax/minimax-m3',
        agent: 'base2-free-minimax-m3',
        contextWindow: 262144,
        maxTokens: 65536,
    },
    {
        id: 'mimo/mimo-v2.5',
        name: 'Freebuff MiMo 2.5',
        description: 'MiMo 2.5 via freebuff (non-premium pool, session quota)',
        upstream: 'mimo/mimo-v2.5',
        session: 'mimo/mimo-v2.5',
        agent: 'base2-free-mimo',
        contextWindow: 131072,
        maxTokens: 32768,
    },
    {
        id: 'openai/gpt-5.6-luna',
        name: 'Freebuff GPT-5.6 Luna',
        description: 'GPT-5.6 Luna via freebuff (premium pool, 6 sessions/day)',
        upstream: 'openai/gpt-5.6-luna',
        session: 'openai/gpt-5.6-luna',
        agent: 'base2-free-luna',
        contextWindow: 262144,
        maxTokens: 65536,
    },
];
