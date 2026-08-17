/**
 * dsh-freebuff — register the `freebuff` provider route on ctx.llm.
 *
 * The provider reverse-proxies the freebuff (CodebuffAI) free client protocol
 * (session → agent-runs → chat/completions on codebuff.com) into the harness
 * LLM seam, exposing free DeepSeek V4 Flash (and friends) as selectable
 * models. Credentials are picked up from plugin settings, the FREEBUFF_TOKEN
 * env var, or the official freebuff CLI credential file.
 */
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import { getOrCreateAnonymousUserId } from '@deepseek-ai/dsh-anonymous-user-id'
import { installFreebuffApi } from './api.js'
import { FreebuffAdapter } from './adapter.js'
import { FreebuffClient } from './freebuff.js'
import { Config, NS, resolveAdapterOptions, type ResolvedOptions } from './config.js'

export const name = 'llm-freebuff'
export const inject = ['llm']
export { Config, NS }
export { FreebuffAdapter } from './adapter.js'
export { FreebuffClient, stableFingerprint } from './freebuff.js'

/** The single provider route this plugin owns. */
export const PROVIDER = 'freebuff'

export function apply(ctx: import('@deepseek-ai/cordis').Context, config: unknown): void {
  let current = () => config
  let lastRaw: unknown
  let lastGood: ResolvedOptions | undefined
  const options = (): ResolvedOptions => {
    const raw = current()
    if (raw === lastRaw && lastGood !== undefined) return lastGood
    try {
      const next = resolveAdapterOptions(raw)
      lastRaw = raw
      lastGood = next
      return next
    } catch (error) {
      if (lastGood === undefined) throw error
      lastRaw = raw
      ctx.logger.error('llm-freebuff: keeping the last good configuration after an invalid settings section')
      ctx.logger.error(error)
      return lastGood
    }
  }
  options()

  const client = new FreebuffClient({
    baseURL: () => options().baseURL,
    proxyUrl: () => (options().upstreamProxy.length > 0 ? options().upstreamProxy : undefined),
    logger: ctx.logger,
  })
  let userId: string | undefined
  const resolveUserId = (): string => (userId ??= getOrCreateAnonymousUserId())
  // The Models settings page writes credentials under the provider's
  // apiKeyEnv ref (FREEBUFF_API_KEY by default). Resolve it through the
  // credentials seam first, then the launching environment.
  const resolveApiKey = async (): Promise<string | undefined> => {
    const ref = options().apiKeyEnv
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref)
      if (hit !== undefined && typeof hit.value === 'string' && hit.value.length > 0) return hit.value
    }
    const ambient = process.env[ref]
    if (ambient !== undefined && ambient.length > 0) return ambient
    return undefined
  }
  const adapter = new FreebuffAdapter({ options, client, userId: resolveUserId, resolveApiKey })

  // Settings panel API (client half renders the Freebuff section on Settings).
  const credentials = ctx.get('credentials') as
    | { resolve: (ref: string) => Promise<{ value: unknown } | undefined>; set: (ref: string, value: string) => Promise<unknown>; unset: (ref: string) => Promise<unknown> }
    | undefined
  installFreebuffApi(ctx as never, {
    options,
    credentials:
      credentials !== undefined
        ? {
            set: (ref, value) => credentials.set(ref, value),
            unset: (ref) => credentials.unset(ref),
          }
        : undefined,
    credentialConfigured: async () => {
      if (credentials === undefined) return false
      const hit = await credentials.resolve(options().apiKeyEnv)
      return hit !== undefined && hit.value !== undefined && hit.value !== null && String(hit.value).length > 0
    },
    probe: async (token) => {
      const result = await client.probeMe(token)
      return { status: result.status, data: result.data }
    },
  })

  ctx.llm.registerConfigurableProviders([
    { provider: PROVIDER, displayName: 'Freebuff', settingsNs: NS, settingsPath: [] },
  ])
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)
  installSettingsSection(ctx, NS, Config, config as Parameters<typeof installSettingsSection>[2], {
    setSource: (source) => {
      current = source
    },
    onChange: () => {
      registration.replace([PROVIDER])
    },
  })
}
