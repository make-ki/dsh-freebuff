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
  token: z
    .string()
    .required()
    .description('freebuff authToken（登录后由官方 CLI 写入 ~/.config/manicode/credentials.json，可从该处复制）'),
  email: z.string().description('账号邮箱（仅用于标识，可留空）'),
  name: z.string().description('账号昵称（可选）'),
})

const ModelSchema = z.object({
  id: z.string().required().description('模型 ID（如 deepseek/deepseek-v4-flash）'),
  name: z.string().default('').description('展示名称'),
  description: z.string().default('').description('一句话描述'),
  upstream: z.string().required().description('上游模型 ID（chat payload 的 model 字段）'),
  session: z.string().required().description('session 模型（x-freebuff-model 请求头）'),
  agent: z.string().required().description('上游 root agent（agent-runs START）'),
  contextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW).description('上下文窗口（tokens）'),
  maxTokens: z.number().step(1).min(1).default(DEFAULT_MAX_TOKENS).description('单次输出上限（tokens）'),
})

export const Config = z.object({
  /** 凭证引用：在「设置 > 模型」的 Freebuff 卡片点「配置凭证」会写入此引用（默认 FREEBUFF_API_KEY）。 */
  apiKeyEnv: z
    .string()
    .role('credential-ref')
    .default('FREEBUFF_API_KEY')
    .description('凭证引用名：模型页「配置凭证」按钮写入的目标（默认 FREEBUFF_API_KEY）'),
  /** 显式 token 列表（每项一个账号）。留空时按顺序尝试：凭证库 → FREEBUFF_TOKEN 环境变量 → 官方 CLI 凭证文件。 */
  accounts: z.array(Account).default([]).description('显式 freebuff token 列表（多账号自动轮换）。留空则自动解析：凭证库 → 环境变量 → 官方 CLI 凭证文件'),
  tokenEnv: z.string().default(DEFAULT_TOKEN_ENV).description('环境变量名（逗号分隔多个 token 表示多账号）'),
  tokenFile: z.string().default(DEFAULT_TOKEN_FILE).description('官方 CLI 凭证文件路径（自动读取 authToken）'),
  baseURL: z.string().default(DEFAULT_BASE_URL).description('上游地址（一般无需修改）'),
  upstreamProxy: z
    .string()
    .default('')
    .description('上游代理（http://host:port）。留空自动选择：DSH 代理变量 → Windows 系统代理 → 环境变量。免费模型要求 US 出口 IP'),
  reasoningEffort: z
    .union(['low', 'high', 'max'])
    .default('high')
    .description('默认推理档位（DeepSeek V4 Flash 支持 low/high/max）'),
  maxTokens: z
    .number()
    .step(1)
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .default(DEFAULT_MAX_TOKENS)
    .description('全局输出上限（tokens），模型级配置优先'),
  defaultContextWindow: z
    .number()
    .step(1)
    .min(1)
    .default(DEFAULT_CONTEXT_WINDOW)
    .description('默认上下文窗口（tokens），模型级配置优先'),
  streamIdleTimeoutMs: z
    .number()
    .min(Number.MIN_VALUE)
    .max(MAX_TIMER_DELAY_MS)
    .default(DEFAULT_STREAM_IDLE_TIMEOUT_MS)
    .description('流式响应空闲超时（毫秒）'),
  models: z.array(ModelSchema).default(DEFAULT_MODELS).collapse().description('模型目录（一般用默认 5 个即可）'),
  retryPolicy: RetryPolicySchema,
})

export interface ResolvedOptions {
  apiKeyEnv: string
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
    apiKeyEnv: String(c.apiKeyEnv ?? 'FREEBUFF_API_KEY'),
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
