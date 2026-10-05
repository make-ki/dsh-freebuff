import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'

const root = new URL('../', import.meta.url)
const read = (name) => readFileSync(new URL(name, root), 'utf8')
test('package targets tested DSH release and ships installer', () => {
  const pkg = JSON.parse(read('package.json'))
  for (const [name, range] of Object.entries(pkg.peerDependencies)) {
    if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(range, '0.2.0-rc.2', name)
  }
  assert.ok(pkg.files.includes('scripts/install.mjs'))
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
})
test('client artifact loads and exports plugin through module loader', () => {
  let loaded
  const script = new Script(read('lib/client.js'))
  script.runInNewContext({ window: { __ModuleLoader__: { load: (value) => { loaded = value } } } })
  assert.equal(loaded.id, 'dsh-freebuff')
  const plugin = loaded.factory((id) => {
    assert.equal(id, 'react')
    return { createElement() {}, useState() {}, useEffect() {}, useCallback() {} }
  })
  assert.equal(typeof plugin.apply, 'function')
  assert.ok(Array.isArray(plugin.inject))
})
