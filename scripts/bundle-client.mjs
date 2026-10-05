/**
 * Wrap the tsdown-compiled client half in the DSH client-modules format:
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 * The factory defines its own module/exports so the CJS body can assign
 * `exports.inject` / `exports.apply` directly.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'

const clientPath = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const raw = readFileSync(clientPath, 'utf8')
if (!raw.trim()) throw new Error('Client bundle is empty')
if (raw.startsWith('window.__ModuleLoader__.load({')) {
  throw new Error('Client bundle is already wrapped; run tsdown before wrapping again')
}
// Validate a CJS script before writing; bare tsc ESM output must not be wrapped.
new Script(raw, { filename: clientPath })
if (!/\b(?:module\.exports|exports\.)/.test(raw)) {
  throw new Error('Client bundle has no CommonJS exports; run tsdown first')
}

const body = raw
  .split('\n')
  .map((line) => '    ' + line.replace(/^\t+/, (tabs) => '  '.repeat(tabs.length)))
  .join('\n')

const out = `window.__ModuleLoader__.load({
  id: "dsh-freebuff",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
    return module.exports;
  }
});
`

new Script(out, { filename: clientPath })
writeFileSync(clientPath, out)
console.log('client.js wrapped in __ModuleLoader__.load')
