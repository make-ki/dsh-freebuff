/**
 * FreebuffAdapter — registers the `freebuff` provider route on ctx.llm.
 * Mirrors the dsh-llm-deepseek adapter structure: serialize → wire → SSE →
 * StreamChunks, with the freebuff client owning the protocol lifecycle
 * (session/run/chat/queue/cooldown).
 */
import {
  CONTEXT_WINDOW_EXCEEDED_CODE,
  LlmAdapter,
  LlmError,
  QUOTA_EXCEEDED_CODE,
  ReasoningEffortId,
  attributionHeaders,
  isContextWindowExceededError,
  isQuotaExceededError,
  type GenerateOptions,
  type LlmModelInfo,
  type LlmResolvedModelInfo,
  type ResolvedRetryPolicy,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout'
import { FreebuffClient, FreebuffUpstreamError, stableFingerprint } from './freebuff.js'
import { resolveAccounts } from './credentials.js'
import { MODEL_EFFORTS, type ModelEntry } from './constants.js'
import { buildUpstreamPayload } from './serialize.js'
import { translate } from './translate.js'
import type { ResolvedOptions } from './config.js'

const STREAM_IDLE_TIMEOUT_CODE = 'LLM_STREAM_IDLE_TIMEOUT'

export interface AdapterConfig {
  options: () => ResolvedOptions
  client: FreebuffClient
  userId: () => string
  /**
   * Resolve the credential-store / env token value for `apiKeyEnv`
   * (the Models page "configure credential" button writes this ref).
   * May hold one token or comma-separated multiple accounts.
   */
  resolveApiKey: () => Promise<string | undefined>
}

const EFFORT_NAMES: Record<string, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
  max: 'Max',
  ultra: 'Ultra',
}

function modelInfo(provider: string, model: ModelEntry): LlmModelInfo {
  return {
    provider,
    id: model.id,
    name: model.name ?? model.id,
    ...(model.description !== undefined ? { description: model.description } : {}),
    inputModalities: ['text'],
  }
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)
}

export class FreebuffAdapter extends LlmAdapter {
  constructor(private config: AdapterConfig) {
    super()
  }

  providerInfo(provider: string): { id: string; name: string } {
    return { id: provider, name: 'Freebuff' }
  }

  providerRetryPolicy(_provider: string): ResolvedRetryPolicy | undefined {
    return this.config.options().retryPolicy
  }

  listModels(provider: string): Promise<LlmModelInfo[]> {
    return Promise.resolve(this.config.options().models.map((m) => modelInfo(provider, m)))
  }

  resolveModel(
    provider: string,
    model: string,
    _signal: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    const connection = this.config.options()
    const configured = connection.models.find((m) => m.id === model)
    const efforts = MODEL_EFFORTS[model] ?? ['high']
    return Promise.resolve({
      ...(configured !== undefined
        ? modelInfo(provider, configured)
        : { provider, id: model, name: model, inputModalities: ['text'] as const }),
      context: {
        contextWindow: configured?.contextWindow ?? connection.defaultContextWindow,
      },
      defaultMaxTokens: configured?.maxTokens ?? connection.maxTokens,
      reasoning: {
        efforts: efforts.map((e) => ({ id: ReasoningEffortId(e), name: EFFORT_NAMES[e] ?? capitalize(e) })),
        defaultEffort: ReasoningEffortId(connection.reasoningEffort),
      },
    })
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const connection = this.config.options()
    const consumer = new AbortController()
    const watchdog = idleWatchdog(
      options.signal === undefined ? consumer.signal : AbortSignal.any([options.signal, consumer.signal]),
      connection.streamIdleTimeoutMs,
      STREAM_IDLE_TIMEOUT_CODE,
    )
    const iterator = this.request(options, watchdog.signal, connection)[Symbol.asyncIterator]()
    let exhausted = false
    try {
      while (true) {
        const result = await watchdog.next(iterator)
        if (result.done) {
          exhausted = true
          return
        }
        yield result.value
      }
    } catch (error) {
      if (timeoutOf(watchdog.signal, STREAM_IDLE_TIMEOUT_CODE) !== undefined) {
        throw new LlmError(
          `Freebuff stream idle timeout after ${connection.streamIdleTimeoutMs}ms`,
          'TIMEOUT',
          { cause: error },
        )
      }
      if (options.signal?.aborted) {
        throw new LlmError('Freebuff request aborted by caller', 'ABORTED', { cause: error })
      }
      if (error instanceof LlmError) throw error
      throw new LlmError('Freebuff API stream failed', 'TRANSPORT', { cause: error })
    } finally {
      consumer.abort('Freebuff stream consumer stopped')
      if (!exhausted && iterator.return !== undefined) {
        try {
          await iterator.return(undefined)
        } catch {
          // transport teardown
        }
      }
    }
  }

  private async *request(
    options: GenerateOptions,
    signal: AbortSignal,
    connection: ResolvedOptions,
  ): AsyncGenerator<StreamChunk> {
    const mc = connection.models.find((m) => m.id === options.model)
    if (mc === undefined) {
      throw new LlmError(`unknown freebuff model: ${options.model}`, 'INVALID_REQUEST')
    }
    const accounts = await resolveAccounts(connection)
    // The Models page credential (apiKeyEnv ref) outranks the other sources:
    // it is what "配置凭证" writes and what the page reports as configured.
    const credentialTokens = (await this.config.resolveApiKey())
      ?.split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0) ?? []
    const allAccounts = [
      ...credentialTokens.map((token) => ({ token })),
      ...accounts.filter((a) => !credentialTokens.includes(a.token)),
    ]
    if (allAccounts.length === 0) {
      throw new LlmError(
        'llm-freebuff: no freebuff account. Add accounts in Settings > Freebuff, export ' +
          connection.tokenEnv +
          ', or log in with the freebuff CLI (its credentials are picked up from ' +
          connection.tokenFile +
          ')',
        'MISSING_CREDENTIAL',
      )
    }

    const attribution: Record<string, string> = {
      ...attributionHeaders(),
      'x-deepseek-harness-user-id': String(this.config.userId()),
      ...(options.sessionId !== undefined ? { 'x-deepseek-harness-session-id': String(options.sessionId) } : {}),
      ...(options.purpose === 'compaction' ? { 'x-deepseek-harness-compact': '1' } : {}),
    }

    const clientId = stableFingerprint(allAccounts[0].token)
    let lastError: unknown

    for (let attempt = 0; attempt < allAccounts.length; attempt++) {
      const account = this.config.client.pickAccount(mc.session, allAccounts)
      if (account === null) break
      // One account = one live instance: the whole request lifecycle
      // (session + run chain + chat stream) must be serialized per account,
      // otherwise a concurrent request's session POST takes this one over
      // (409 session_superseded).
      const lock = this.config.client.acquireAccountLock(account.token)
      try {
        await Promise.race([
          lock.wait,
          new Promise<never>((_, reject) => {
            if (signal.aborted) {
              reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
              return
            }
            signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })),
            )
          }),
        ])
        const session = await this.config.client.getSession(account.token, mc.session)
        const run = await this.config.client.ensureRun(account.token, mc.agent)
        const payload = buildUpstreamPayload(options as never, mc, session, run.runId, clientId)
        const onStale = async (status: number): Promise<string> => {
          // 409 = our session was taken over: reuse the current occupant's
          // instance instead of deleting it (deleting causes takeover loops).
          const fresh =
            status === 409
              ? await this.config.client.recoverSession(account.token, mc.session)
              : await this.config.client.getSession(account.token, mc.session, true)
          return fresh.instanceId
        }
        const upstream = this.config.client.chatStream(account.token, session.instanceId, payload, {
          signal,
          extraHeaders: attribution,
          onStale,
        })
        yield* translate(upstream)
        return
      } catch (error) {
        lastError = error
        if (error instanceof FreebuffUpstreamError) {
          const quotaish =
            error.status === 429 ||
            isQuotaExceededError(error.message) ||
            /stayed queued|create session failed|session_model_mismatch|spend_limited|reduced capacity/i.test(error.message)
          const transient = /start_run failed|timeout|timed out|abort|terminated|session stayed stale/i.test(error.message)
          if (quotaish || transient) {
            this.config.client.cooldown(account.token, error.retryAfterMs ?? 60_000)
            continue
          }
        }
        break
      } finally {
        // Release unconditionally: a taken lock hands the slot to the next
        // caller; an abort-while-waiting also releases so queued callers
        // are not stuck behind this never-held gate.
        lock.release()
      }
    }
    throw this.mapError(lastError)
  }

  private mapError(error: unknown): LlmError {
    if (error instanceof LlmError) return error
    if (error instanceof FreebuffUpstreamError) {
      const detail = error.message
      const options: Record<string, unknown> = { status: error.status }
      if (error.retryAfterMs !== undefined) options.providerRetryAfterMs = error.retryAfterMs
      if (error.status === 401 || error.status === 403) {
        return new LlmError(detail, 'AUTH', options)
      }
      if (/banned/i.test(detail)) {
        return new LlmError(detail + ' (freebuff account banned — terminal)', 'AUTH', options)
      }
      if (error.status === 409 && /session_superseded/i.test(detail)) {
        return new LlmError(
          'freebuff 账号被另一个客户端占用（session_superseded）：同一账号同一时间只允许一个在线实例。请关闭 freebuff 官方 CLI / 桌面端 / 网页版后重试。',
          'RATE_LIMIT',
          options,
        )
      }
      if (isQuotaExceededError(detail)) {
        return new LlmError(detail, QUOTA_EXCEEDED_CODE, options)
      }
      if (error.status === 429) {
        if (/spend_limited|reduced capacity|flagged for VPN|proxy usage|restricted location/i.test(detail)) {
          const hours = error.retryAfterMs !== undefined ? Math.round(error.retryAfterMs / 3_600_000) : undefined
          return new LlmError(
            'freebuff 账号被风控标记（spend_limited）：该账号被识别为 VPN/代理使用或受限地区，额度已降低' +
              (hours !== undefined ? '（冷却约 ' + hours + ' 小时）' : '') +
              '。对策：换干净的美区代理节点或直连后重试；或换一个未被标记的账号（多账号用逗号分隔配置到 FREEBUFF_TOKEN）。',
            QUOTA_EXCEEDED_CODE,
            options,
          )
        }
        return new LlmError(detail, 'RATE_LIMIT', options)
      }
      if (error.status === 400) {
        if (isContextWindowExceededError(detail)) {
          return new LlmError(detail, CONTEXT_WINDOW_EXCEEDED_CODE, options)
        }
        return new LlmError(detail, 'INVALID_REQUEST', options)
      }
      if (error.status >= 500) {
        return new LlmError(detail, 'SERVER', options)
      }
      return new LlmError(detail, `HTTP_${error.status}`, options)
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return new LlmError('Freebuff request aborted', 'ABORTED', { cause: error })
    }
    const message = error instanceof Error ? error.message ?? String(error) : String(error)
    return new LlmError('Freebuff API request failed: ' + message, 'TRANSPORT', { cause: error })
  }
}
