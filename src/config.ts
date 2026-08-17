import z from '@deepseek-ai/schemastery'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  RetryPolicySchema,
  resolveRetryPolicy,
  type ResolvedRetryPolicy,
  type RetryPolicyConfig,
} from '@deepseek-ai/dsh-llm'
import { DEFAULT_BASE_URL, DEFAULT_MODELS, type ModelEntry } from './constants.js'

export const NS = settingsNamespace('llm-freebuff')

export const DEFAULT_MAX_TOKENS = 65536
export const DEFAULT_CONTEXT_WINDOW = 393216
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000
export const DEFAULT_TOKEN_FILE = '~/.config/manicode/credentials.json'
export const DEFAULT_TOKEN_ENV = 'FREEBUFF_TOKEN'

const Account = z.object({
  token: z.string().required(),
  email: z.string(),
  name: z.string(),
})

const ModelSchema = z.object({
  id: z.string().required(),
  name: z.string().default(''),
  description: z.string().default(''),
  upstream: z.string().required(),
  session: z.string().required(),
  agent: z.string().required(),
  contextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
  maxTokens: z.number().step(1).min(1).default(DEFAULT_MAX_TOKENS),
})

export const Config = z.object({
  /** Explicit freebuff auth tokens (one per account). Empty = auto-resolve. */
  accounts: z.array(Account).default([]),
  /** Env var holding comma-separated tokens, consulted after `accounts`. */
  tokenEnv: z.string().default(DEFAULT_TOKEN_ENV),
  /** JSON credential file (official CLI layout), consulted last. */
  tokenFile: z.string().default(DEFAULT_TOKEN_FILE),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  /** http(s) proxy for upstream traffic; empty = HTTPS_PROXY/http_proxy env. */
  upstreamProxy: z.string().default(''),
  models: z.array(ModelSchema).default(DEFAULT_MODELS),
  maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_TOKENS),
  defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
  streamIdleTimeoutMs: z
    .number()
    .min(Number.MIN_VALUE)
    .max(MAX_TIMER_DELAY_MS)
    .default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  reasoningEffort: z.union(['low', 'high', 'max']).default('high'),
  retryPolicy: RetryPolicySchema,
})

export interface ResolvedOptions {
  accounts: { token: string; email?: string; name?: string }[]
  tokenEnv: string
  tokenFile: string
  baseURL: string
  upstreamProxy: string
  models: ModelEntry[]
  maxTokens: number
  defaultContextWindow: number
  streamIdleTimeoutMs: number
  reasoningEffort: 'low' | 'high' | 'max'
  retryPolicy: ResolvedRetryPolicy
}

function resolveModels(models: unknown): ModelEntry[] {
  const seen = new Set<string>()
  return (models as ModelEntry[] ?? DEFAULT_MODELS).map((m) => {
    if (!m.id || m.id.length === 0) throw new Error('llm-freebuff: model ids must be non-empty')
    if (!m.session || !m.agent) throw new Error(`llm-freebuff: model "${m.id}" needs session and agent`)
    if (!Number.isInteger(m.contextWindow) || m.contextWindow <= 0)
      throw new Error(`llm-freebuff: model "${m.id}" contextWindow must be a positive integer`)
    if (!Number.isInteger(m.maxTokens) || m.maxTokens <= 0)
      throw new Error(`llm-freebuff: model "${m.id}" maxTokens must be a positive integer`)
    if (seen.has(m.id)) throw new Error(`llm-freebuff: duplicate model "${m.id}"`)
    seen.add(m.id)
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      upstream: m.upstream,
      session: m.session,
      agent: m.agent,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
    }
  })
}

export function resolveAdapterOptions(config: unknown): ResolvedOptions {
  const c = config as Partial<ResolvedOptions> & Record<string, unknown>
  const models = resolveModels(c.models)
  if (c.defaultContextWindow !== undefined && (!Number.isInteger(c.defaultContextWindow) || c.defaultContextWindow <= 0))
    throw new Error('llm-freebuff: defaultContextWindow must be a positive integer')
  if (c.maxTokens !== undefined && (!Number.isSafeInteger(c.maxTokens) || c.maxTokens <= 0))
    throw new Error('llm-freebuff: maxTokens must be a positive safe integer')
  const streamIdleTimeoutMs = c.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS)
    throw new Error(`llm-freebuff: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`)
  return {
    accounts: Array.isArray(c.accounts)
      ? (c.accounts as { token: string; email?: string; name?: string }[]).map((a) => ({
          token: String(a.token ?? '').trim(),
          ...(a.email !== undefined ? { email: String(a.email) } : {}),
          ...(a.name !== undefined ? { name: String(a.name) } : {}),
        })).filter((a) => a.token.length > 0)
      : [],
    tokenEnv: String(c.tokenEnv ?? DEFAULT_TOKEN_ENV),
    tokenFile: String(c.tokenFile ?? DEFAULT_TOKEN_FILE),
    baseURL: String(c.baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    upstreamProxy: String(c.upstreamProxy ?? ''),
    models,
    maxTokens: c.maxTokens ?? DEFAULT_MAX_TOKENS,
    defaultContextWindow: c.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW,
    streamIdleTimeoutMs,
    reasoningEffort: (c.reasoningEffort ?? 'high') as 'low' | 'high' | 'max',
    retryPolicy: resolveRetryPolicy(c.retryPolicy as RetryPolicyConfig | undefined, 'llm-freebuff: retryPolicy'),
  }
}
