import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { resolveAdapterOptions, Config } from '../lib/config.js'
import { resolveEffectiveAccounts } from '../lib/credentials.js'
import { serializeMessages, buildUpstreamPayload } from '../lib/serialize.js'
import { translate } from '../lib/translate.js'
import { installFreebuffApi } from '../lib/api.js'
import { apply } from '../lib/index.js'
import { createVolatile, updateVolatile } from '@deepseek-ai/cosmokit'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

async function collect(iterable) {
  const values = []
  for await (const value of iterable) values.push(value)
  return values
}

const options = () => resolveAdapterOptions({ accounts: [{ token: 'fallback-test-account' }], tokenEnv: 'FREEBUFF_OFFLINE_TEST_TOKEN', tokenFile: '/nonexistent/freebuff-offline-test.json' })

test('rc.2 live Config resolves volatile values on every operation', () => {
  const maxTokens = createVolatile(128)
  const config = { maxTokens }
  assert.equal(resolveAdapterOptions(config).maxTokens, 128)
  updateVolatile(maxTokens, createVolatile(256))
  assert.equal(resolveAdapterOptions(config).maxTokens, 256)
  assert.throws(() => resolveAdapterOptions({ apiKeyEnv: 'INVALID-REF' }))
})

test('serializer preserves current first-class tool results and developer instructions', () => {
  const messages = [
    { role: 'developer', content: [{ type: 'text', text: 'Follow the tool result.' }] },
    { role: 'assistant', content: [{ type: 'tool-call', id: 'call-1', name: 'read', arguments: '{"path":"x"}' }] },
    { role: 'tool', toolCallId: 'call-1', content: [{ type: 'text', text: 'file content' }] },
  ]
  const wire = serializeMessages(messages)
  assert.equal(wire[0].role, 'developer')
  assert.deepEqual(wire[2], { role: 'tool', tool_call_id: 'call-1', content: 'file content' })
  const payload = buildUpstreamPayload({ model: options().models[0].id, messages }, options().models[0], { instanceId: 'offline-instance' }, 'run', 'client')
  assert.equal(payload.messages[0].role, 'system')
  assert.equal(payload.messages[2].tool_call_id, 'call-1')
})

test('translator uses current ToolCallId and keeps deltas, usage and terminal order', async () => {
  async function* chunks() {
    yield { choices: [{ delta: { tool_calls: [{ id: 'call-1', function: { name: 'read', arguments: '{' } }] } }] }
    yield { choices: [{ delta: { tool_calls: [{ function: { arguments: '}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 10, completion_tokens: 2, prompt_cache_hit_tokens: 4 } }
    yield '[DONE]'
  }
  const result = await collect(translate(chunks()))
  assert.deepEqual(result.find((c) => c.type === 'block-end').block, { type: 'tool-call', id: 'call-1', name: 'read', arguments: '{}' })
  assert.deepEqual(result.at(-2), { type: 'usage', usage: { inputTokens: 6, outputTokens: 2, cacheReadTokens: 4 } })
  assert.deepEqual(result.at(-1), { type: 'finish', reason: { kind: 'tool-calls' } })
  await assert.rejects(collect(translate((async function* () { yield { choices: [] } })())), { code: 'STREAM_CLOSED' })
})

test('credential-store accounts precede fallback and split UI-supported newlines', async () => {
  assert.deepEqual(await resolveEffectiveAccounts(options(), async () => 'first\nsecond,first'), [
    { token: 'first' }, { token: 'second' }, { token: 'fallback-test-account' },
  ])
})

test('API registers rc.2 prefix route, uses saved credentials for probe and disposes', async () => {
  let route, dispose, disposed = false, probed
  const ctx = {
    get: () => ({ register: (value) => { route = value; return () => { disposed = true } } }),
    effect: (fn) => { dispose = fn() }, logger: { warn() {} },
  }
  installFreebuffApi(ctx, {
    options, credentials: undefined, credentialConfigured: async () => true,
    resolveApiKey: async () => 'store-only-account',
    probe: async (token) => { probed = token; return { status: 200, data: { uid: 'offline-user' } } },
  })
  assert.equal(route.kind, 'prefix')
  const req = Readable.from([])
  req.method = 'POST'; req.url = '/freebuff/api/probe'
  let body, status
  await route.handler(req, { writeHead(code) { status = code }, end(text) { body = JSON.parse(text) } })
  assert.equal(status, 200); assert.equal(body.ok, true); assert.equal(probed, 'store-only-account')
  dispose(); assert.equal(disposed, true)
})

test('host uses Loader namespace, branded refs and observes live update without profile access', async () => {
  let provider, adapter, update, replaced = 0, ref
  const registration = () => {}
  registration.replace = () => { replaced++ }
  const ctx = {
    fiber: { name: 'custom-freebuff-instance' }, logger: { error() {}, warn() {}, info() {} },
    get: (name) => name === 'credentials' ? { resolve: async (value) => { ref = value; return { value: 'offline-key', source: 'test' } } } : undefined,
    inject() {},
    on: (event, callback) => { assert.equal(event, 'loader/volatile-update'); update = callback },
    llm: { registerConfigurableProviders: (entries) => { provider = entries[0] }, registerAdapter: (_providers, value) => { adapter = value; return registration } },
  }
  apply(ctx, {})
  assert.equal(provider.settingsNs, ctx.fiber.name)
  assert.equal(await adapter.config.resolveApiKey(), 'offline-key')
  assert.equal(ref, credentialRef('FREEBUFF_API_KEY'))
  update(); assert.equal(replaced, 1)
})
