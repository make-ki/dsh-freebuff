#!/bin/bash
# Build against a DSH checkout (DSH_CHECKOUT) or the global DSH install.
# Install local devDependencies first; never replace local @types/node.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE=""
DEP_ROOT=""
if [ -n "${DSH_CHECKOUT:-}" ]; then
  if [ ! -d "$DSH_CHECKOUT/packages" ]; then
    echo "build: invalid DSH_CHECKOUT: $DSH_CHECKOUT" >&2
    exit 1
  fi
  MODE=checkout
  DEP_ROOT="$DSH_CHECKOUT"
else
  GLOBAL_NM="$(npm root -g)"
  if [ -d "$GLOBAL_NM/@deepseek-ai/dsh/node_modules" ]; then
    MODE=global
    DEP_ROOT="$GLOBAL_NM/@deepseek-ai/dsh"
  fi
fi
if [ -z "$MODE" ]; then
  echo "build: cannot locate a DSH checkout (set DSH_CHECKOUT) or global @deepseek-ai/dsh install" >&2
  exit 1
fi
echo "build: dependency root = $MODE ($DEP_ROOT)"

TSC="node_modules/.bin/tsc"
if [ ! -x "$TSC" ] || [ ! -f node_modules/@types/node/package.json ]; then
  echo "build: local TypeScript or @types/node missing; run: npm install" >&2
  exit 1
fi

link_pkg() {
  local name="$1"
  local rel
  if [ "$MODE" = checkout ]; then
    case "$name" in
      cordis) rel="vendor/cordis" ;;
      cordis-plugin-loader) rel="vendor/loader" ;;
      cosmokit) rel="vendor/cosmokit" ;;
      dsh-credentials) rel="packages/credentials/credentials" ;;
      dsh-host-webserver) rel="packages/host/webserver" ;;
      schemastery) rel="vendor/schemastery" ;;
      dsh-llm) rel="packages/llm/llm" ;;
      dsh-settings) rel="packages/settings/settings" ;;
      dsh-timeout) rel="packages/util/timeout" ;;
      dsh-anonymous-user-id) rel="packages/identity/anonymous-user-id" ;;
      *) echo "build: no checkout path for $name" >&2; return 1 ;;
    esac
  else
    rel="node_modules/@deepseek-ai/$name"
  fi
  local target="$DEP_ROOT/$rel"
  if [ ! -f "$target/package.json" ]; then
    echo "build: dependency target missing: $target" >&2
    return 1
  fi
  node --input-type=commonjs - "$name" "$target" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const name = '@deepseek-ai/' + process.argv[2];
const target = path.resolve(process.argv[3]);
const parent = path.resolve('node_modules/@deepseek-ai');
const link = path.resolve('node_modules', name);
if (path.dirname(link) !== parent) throw new Error(`Unexpected link path: ${link}`);
const expected = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
if (expected.name !== name) throw new Error(`Unexpected dependency at ${target}: ${expected.name}`);
let existing;
try { existing = fs.lstatSync(link); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (existing && !existing.isSymbolicLink()) {
  // npm-installed dependencies are user-owned: keep matching versions, never delete them.
  const actual = JSON.parse(fs.readFileSync(path.join(link, 'package.json'), 'utf8'));
  if (actual.name !== name || actual.version !== expected.version) {
    throw new Error(`${link} is ${actual.name}@${actual.version}; expected ${name}@${expected.version}. Run npm install with matching peer dependencies.`);
  }
  console.log(`build: keeping local ${name}@${actual.version}`);
} else {
  if (existing) {
    try { if (fs.realpathSync(link) === fs.realpathSync(target)) process.exit(0); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (existing) fs.unlinkSync(link); // Verified exact package path; remove only the link.
  fs.mkdirSync(parent, { recursive: true });
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`build: linked ${name}@${expected.version}`);
}
NODE
}

echo "=== Resolving scoped build dependencies ==="
for name in cordis cordis-plugin-loader cosmokit schemastery dsh-credentials dsh-host-webserver dsh-llm dsh-settings dsh-timeout dsh-anonymous-user-id; do
  link_pkg "$name"
done

echo "=== Compiling src → lib ==="
"$TSC" -p tsconfig.json

echo "=== Building client bundle (tsdown + __ModuleLoader__ wrap) ==="
npm run build:client
node --check lib/client.js
node --input-type=commonjs -e '
  const client = require("node:fs").readFileSync("lib/client.js", "utf8");
  if (!client.startsWith("window.__ModuleLoader__.load({")) {
    throw new Error("client bundle missing __ModuleLoader__ wrapper");
  }
'
echo "=== Build complete ==="
