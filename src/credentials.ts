/**
 * Account resolution for the freebuff provider, in precedence order:
 *   1. explicit `accounts` from plugin settings
 *   2. `FREEBUFF_TOKEN` env var (comma-separated tokens)
 *   3. the official CLI credential file (default `~/.config/manicode/credentials.json`),
 *      which is where a locally installed freebuff CLI keeps its login —
 *      {default: {authToken, email, name, fingerprintId}} or {accounts: {…}}
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { ResolvedOptions } from './config.js'

export interface FreebuffAccount {
  token: string
  email?: string
  name?: string
  fingerprintId?: string
}

export async function resolveEffectiveAccounts(options: ResolvedOptions, resolveApiKey: () => Promise<string | undefined>): Promise<FreebuffAccount[]> {
  const tokens = (await resolveApiKey())?.split(/[,\r\n]+/).map((token) => token.trim()).filter(Boolean) ?? []
  const accounts = await resolveAccounts(options)
  return [...new Set(tokens)].map((token) => ({ token })).concat(accounts.filter((account) => !tokens.includes(account.token)))
}

export function expandHome(file: string): string {
  if (file === '~') return homedir()
  if (file.startsWith('~/') || file.startsWith('~\\')) return path.join(homedir(), file.slice(2))
  return file
}

const fileCache = new Map<string, { at: number; accounts: FreebuffAccount[] }>()
const FILE_CACHE_TTL_MS = 30_000

export async function resolveAccounts(
  options: ResolvedOptions,
): Promise<FreebuffAccount[]> {
  if (options.accounts.length > 0) return options.accounts

  const env = process.env[options.tokenEnv]
  if (env && env.trim()) {
    return env
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((token) => ({ token }))
  }

  const file = expandHome(options.tokenFile)
  const cached = fileCache.get(file)
  if (cached && Date.now() - cached.at < FILE_CACHE_TTL_MS) return cached.accounts
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
    const out: FreebuffAccount[] = []
    const def = raw.default as Record<string, unknown> | undefined
    if (def && typeof def === 'object' && typeof def.authToken === 'string' && def.authToken) {
      out.push({
        token: def.authToken,
        ...(typeof def.email === 'string' ? { email: def.email } : {}),
        ...(typeof def.name === 'string' ? { name: def.name } : {}),
        ...(typeof def.fingerprintId === 'string' ? { fingerprintId: def.fingerprintId } : {}),
      })
    }
    const accounts = raw.accounts as Record<string, Record<string, unknown>> | undefined
    if (accounts && typeof accounts === 'object') {
      for (const entry of Object.values(accounts)) {
        if (entry && typeof entry === 'object' && typeof entry.authToken === 'string' && entry.authToken) {
          out.push({
            token: entry.authToken,
            ...(typeof entry.email === 'string' ? { email: entry.email } : {}),
            ...(typeof entry.name === 'string' ? { name: entry.name } : {}),
            ...(typeof entry.fingerprintId === 'string' ? { fingerprintId: entry.fingerprintId } : {}),
          })
        }
      }
    }
    fileCache.set(file, { at: Date.now(), accounts: out })
    return out
  } catch {
    return []
  }
}
