import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const installer = fileURLToPath(new URL('./install.mjs', import.meta.url))
function run(...args) {
  return spawnSync(process.execPath, [installer, ...args], { encoding: 'utf8' })
}
test('default helper only prints the fork command', () => {
  const result = run()
  assert.equal(result.status, 0)
  assert.match(result.stdout, /dsh plugin --profile web add github:make-ki\/dsh-freebuff/)
})
test('custom profile is included in the printed command', () => {
  const result = run('--profile', 'test-profile')
  assert.equal(result.status, 0)
  assert.match(result.stdout, /--profile test-profile add/)
})
test('invalid options fail before running the installer', () => {
  for (const args of [['--profile'], ['--tgz'], ['--unknown'], ['--profile', '../web'], ['--tgz', '/nonexistent/dsh-freebuff.tgz']]) {
    const result = run(...args)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Install failed:/)
  }
})
test('help does not install a package', () => {
  const result = run('--help')
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Usage:/)
})
