#!/usr/bin/env node
/** Install through DSH's compatibility-checked, transactional plugin manager. */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
let profile = 'web'
let tgz
try {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/install.mjs [--profile <name>] [--tgz <local-package>]')
      console.log('Without --tgz, prints the GitHub install command without modifying any profile.')
      process.exit(0)
    }
    if (arg !== '--profile' && arg !== '--tgz') throw new Error(`Unknown argument: ${arg}`)
    const value = args[++i]
    if (!value || value.startsWith('-')) throw new Error(`Missing value for ${arg}`)
    if (arg === '--profile') profile = value
    else tgz = value
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(profile)) throw new Error('Invalid profile name')
  if (tgz !== undefined) {
    const absolute = path.resolve(tgz)
    if (!existsSync(absolute)) throw new Error(`Package not found: ${absolute}`)
    const proxy = process.env.DSH_PROXY_HTTPS || process.env.HTTPS_PROXY || process.env.https_proxy
    const proxyArgs = proxy ? ['--proxy', proxy, '--https-proxy', proxy] : []
    const result = spawnSync('dsh', ['plugin', '--profile', profile, 'add', absolute, ...proxyArgs], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
    console.log('Installed through DSH. Restart the selected profile to load the plugin.')
  } else {
    console.log(`dsh plugin --profile ${profile} add github:make-ki/dsh-freebuff`)
    console.log('DSH 0.2.0-rc.2 automatically registers the bundle; no manual profile edit is needed.')
  }
  console.log('Select Freebuff → deepseek/deepseek-v4-flash in Models settings after restart.')
} catch (error) {
  console.error(`Install failed: ${error.message}`)
  process.exit(1)
}
