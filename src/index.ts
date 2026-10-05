import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
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
export const PROVIDER = 'freebuff'

export function apply(ctx: Context, config: unknown): void {
  let lastGood: ResolvedOptions | undefined
  const options = (): ResolvedOptions => {
    try {
      return (lastGood = resolveAdapterOptions(config))
    } catch (error) {
      if (lastGood === undefined) throw error
      ctx.logger.error('llm-freebuff: keeping the last good configuration after an invalid settings section')
      ctx.logger.error(error)
      return lastGood
    }
  }
  options()
  const client = new FreebuffClient({
    baseURL: () => options().baseURL,
    proxyUrl: () => options().upstreamProxy || undefined,
    logger: ctx.logger,
  })
  let userId: string | undefined
  const resolveApiKey = async (): Promise<string | undefined> => {
    const ref = credentialRef(options().apiKeyEnv)
    const credentials = ctx.get('credentials')
    const hit = await credentials?.resolve(ref)
    return hit?.value ?? process.env[ref]
  }
  const adapter = new FreebuffAdapter({ options, client, userId: () => (userId ??= getOrCreateAnonymousUserId()), resolveApiKey })
  ctx.inject(['webServer'], (child) => {
    installFreebuffApi(child, {
      options,
      credentials: {
        set: async (ref, value) => {
          const credentials = ctx.get('credentials')
          if (credentials === undefined) throw new Error('credentials service unavailable')
          await credentials.set(credentialRef(ref), value)
        },
        unset: async (ref) => {
          const credentials = ctx.get('credentials')
          if (credentials === undefined) throw new Error('credentials service unavailable')
          await credentials.unset(credentialRef(ref))
        },
      },
      resolveApiKey,
      credentialConfigured: async () => {
        const credentials = ctx.get('credentials')
        if (credentials !== undefined) return (await credentials.describe(credentialRef(options().apiKeyEnv))).configured
        return Boolean(process.env[options().apiKeyEnv])
      },
      probe: (token) => client.probeMe(token),
    })
  })
  ctx.llm.registerConfigurableProviders([
    { provider: PROVIDER, displayName: 'Freebuff', settingsNs: ctx.fiber.name, settingsPath: [] },
  ])
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)
  ctx.on('loader/volatile-update', () => registration.replace([PROVIDER]))
}
