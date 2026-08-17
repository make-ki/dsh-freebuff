/**
 * Protocol smoke test: exercises the real freebuff upstream chain
 * (session → agent-runs → chat/completions → SSE → StreamChunks) with the
 * locally resolved account. Consumes one session slot per run.
 *
 * Usage: node test/smoke.mjs ["prompt"]
 */
import { FreebuffClient, stableFingerprint } from '../lib/freebuff.js'
import { resolveAccounts } from '../lib/credentials.js'
import { resolveAdapterOptions } from '../lib/config.js'
import { buildUpstreamPayload } from '../lib/serialize.js'
import { translate } from '../lib/translate.js'

const options = resolveAdapterOptions({})
const accounts = await resolveAccounts(options)
if (accounts.length === 0) {
  console.error('NO ACCOUNTS: set FREEBUFF_TOKEN or log in with the freebuff CLI')
  process.exit(1)
}
console.log('accounts:', accounts.length, accounts.map((a) => a.email ?? a.token.slice(0, 8) + '…').join(', '))
console.log('baseURL:', options.baseURL, '| proxy:', options.upstreamProxy || '(env)')

const client = new FreebuffClient({
  baseURL: () => options.baseURL,
  proxyUrl: () => (options.upstreamProxy.length > 0 ? options.upstreamProxy : undefined),
  logger: console,
})
const model = 'deepseek/deepseek-v4-flash'
const mc = options.models.find((m) => m.id === model)
if (!mc) throw new Error('model not in catalog')

const acct = client.pickAccount(mc.session, accounts)
if (!acct) throw new Error('no usable account (all cooled down?)')
console.log('using account:', acct.email ?? acct.token.slice(0, 8) + '…')

const prompt = process.argv[2] ?? 'Reply with exactly: OK'

console.log('[1/4] session…')
const session = await client.getSession(acct.token, mc.session)
console.log('  instance:', session.instanceId)
console.log('[2/4] agent-runs…')
const run = await client.ensureRun(acct.token, mc.agent)
console.log('  run:', run.runId, 'child:', run.childRunId)
console.log('[3/4] chat/completions…')
const payload = buildUpstreamPayload(
  {
    model: mc.id,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    maxTokens: 512,
  },
  mc,
  session,
  run.runId,
  stableFingerprint(acct.token),
)
let text = ''
let reasoning = 0
let usage = null
let finish = null
const started = Date.now()
for await (const chunk of translate(client.chatStream(acct.token, session.instanceId, payload, {}))) {
  if (chunk.type === 'text-delta') text += chunk.text
  else if (chunk.type === 'reasoning-delta') reasoning += chunk.text.length
  else if (chunk.type === 'usage') usage = chunk.usage
  else if (chunk.type === 'finish') finish = chunk.reason
}
console.log('[4/4] done in', ((Date.now() - started) / 1000).toFixed(1) + 's', '| reasoning chars:', reasoning)
console.log('finish:', JSON.stringify(finish))
console.log('usage:', JSON.stringify(usage))
console.log('RESPONSE:', JSON.stringify(text.slice(0, 400)))
if (text.length === 0) {
  console.error('EMPTY RESPONSE — upstream returned no content')
  process.exit(2)
}
console.log('SMOKE OK')
