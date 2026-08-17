#!/usr/bin/env node
/**
 * dsh-freebuff 一键安装脚本
 *
 * 用法：
 *   node scripts/install.mjs [--profile <name>] [--tgz <本地包路径>]
 *
 * 默认：--profile web；无 --tgz 时只做 bundle 装配（假设已用 dsh plugin add 装好依赖）。
 * 步骤：
 *   1) 有 --tgz：在 profile 目录执行 `pnpm add <tgz>`（装依赖 + 解析 peer）
 *   2) 幂等写入 profile package.json 的 dsh.profile.bundles，加入 dsh-freebuff
 *   3) 打印重启指引
 *
 * 代理：若 DSH_PROXY_HTTPS / HTTPS_PROXY 已设置，会传给 pnpm（下载 registry 依赖时需要）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const profile = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : 'web'
const tgzIdx = args.indexOf('--tgz')
const tgz = tgzIdx >= 0 ? args[tgzIdx + 1] : undefined

const dshHome = process.env.DSH_HOME || path.join(homedir(), '.dsh')
const profileDir = path.join(dshHome, 'profiles', profile)
const profilePkgPath = path.join(profileDir, 'package.json')

if (!existsSync(profilePkgPath)) {
  console.error(`❌ 未找到 profile 清单：${profilePkgPath}`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(profilePkgPath, 'utf8'))

// 1) 安装依赖（可选的 pnpm add）
if (tgz) {
  const absolute = path.resolve(tgz)
  if (!existsSync(absolute)) {
    console.error(`❌ tgz 不存在：${absolute}`)
    process.exit(1)
  }
  console.log(`[1/3] pnpm add ${absolute}（profile: ${profile}）…`)
  const proxyArgs = []
  const proxy = process.env.DSH_PROXY_HTTPS || process.env.HTTPS_PROXY || process.env.https_proxy
  if (proxy) proxyArgs.push('--proxy', proxy, '--https-proxy', proxy)
  const run = spawnSync('pnpm', ['add', absolute, '--no-frozen-lockfile', ...proxyArgs], {
    cwd: profileDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (run.status !== 0) {
    console.error('❌ pnpm add 失败。若为网络/下载错误，请显式加代理：')
    console.error('   dsh plugin --profile web add <tgz> --proxy http://127.0.0.1:10808 --https-proxy http://127.0.0.1:10808')
    process.exit(1)
  }
} else {
  console.log('[1/3] 跳过 pnpm add（未提供 --tgz）；假设依赖已安装（dsh plugin add）')
}

// 2) bundles 幂等写入
const bundles = (pkg.dsh?.profile?.bundles ?? []) 
if (!Array.isArray(bundles)) {
  console.error('❌ profile package.json 的 dsh.profile.bundles 不是数组')
  process.exit(1)
}
if (!bundles.includes('dsh-freebuff')) {
  bundles.push('dsh-freebuff')
  pkg.dsh = { ...(pkg.dsh ?? {}), profile: { ...(pkg.dsh?.profile ?? {}), bundles } }
  writeFileSync(profilePkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log('[2/3] ✅ 已把 dsh-freebuff 加入 dsh.profile.bundles')
} else {
  console.log('[2/3] dsh-freebuff 已在 bundles 中，跳过')
}

// 3) 指引
console.log('[3/3] 完成。')
console.log('')
console.log('下一步：')
console.log('  1. 重启 dsh web（dsh web 或重启 Web 界面服务）')
console.log('  2. 打开 模型设置页 → 提供商 Freebuff → deepseek/deepseek-v4-flash')
console.log('  3. 若上游连接失败，检查日志里的 "llm-freebuff: upstream proxy source=..." 行，')
console.log('     或在 设置 → Freebuff → upstreamProxy 显式填写代理地址')