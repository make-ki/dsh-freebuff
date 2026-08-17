/**
 * Wrap the tsdown-compiled client half in the DSH client-modules format:
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 * The factory defines its own module/exports so the CJS body can assign
 * `exports.inject` / `exports.apply` directly.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const raw = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

const body = raw
  .split('\n')
  .map((line) => '    ' + line)
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

writeFileSync(join(root, 'lib', 'client.js'), out)
console.log('client.js wrapped in __ModuleLoader__.load')
