#!/bin/bash
# Build dsh-freebuff: compile src/ → lib/ with tsc, linking @deepseek-ai/*
# build+runtime deps from either a dsh source checkout (DSH_CHECKOUT) or the
# global npm install of @deepseek-ai/dsh (the running harness).
# Requires devDependencies installed: npm install  (typescript + @types/node)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── 1. dependency root ──────────────────────────────────────────────────────
MODE=""
DEP_NM=""          # directory whose children are @deepseek-ai/* packages
if [ -n "${DSH_CHECKOUT:-}" ] && [ -d "$DSH_CHECKOUT/packages" ]; then
  MODE=checkout
  DEP_NM="$DSH_CHECKOUT"
  echo "build: dependency root = dsh checkout ($DSH_CHECKOUT)"
else
  GLOBAL_NM="$(npm root -g)"
  if [ -d "$GLOBAL_NM/@deepseek-ai/dsh/node_modules" ]; then
    MODE=global
    DEP_NM="$GLOBAL_NM/@deepseek-ai/dsh"
    echo "build: dependency root = global dsh install ($DEP_NM)"
  fi
fi
if [ -z "$MODE" ]; then
  echo "build: cannot locate a dsh checkout (set DSH_CHECKOUT) or a global @deepseek-ai/dsh install" >&2
  exit 1
fi

# ── 2. tsc ──────────────────────────────────────────────────────────────────
TSC="node_modules/.bin/tsc"
if [ ! -f "$TSC.cmd" ] && [ ! -x "$TSC" ]; then
  echo "build: tsc not found; run: npm install" >&2
  exit 1
fi

# ── 3. link @deepseek-ai/* build deps ───────────────────────────────────────
link_pkg() {
  local name="$1"
  local rel
  if [ "$MODE" = checkout ]; then
    # source-checkout layout: @deepseek-ai/* live under packages/…, cordis under vendor/
    case "$name" in
      cordis)     rel="vendor/cordis" ;;
      cosmokit)   rel="vendor/cosmokit" ;;
      schemastery) rel="vendor/schemastery" ;;
      dsh-llm)    rel="packages/llm/llm" ;;
      dsh-settings) rel="packages/settings/settings" ;;
      dsh-timeout) rel="packages/core/timeout" ;;
      dsh-anonymous-user-id) rel="packages/core/anonymous-user-id" ;;
      dsh-home-paths) rel="packages/core/home-paths" ;;
      dsh-brand)  rel="packages/core/brand" ;;
      dsh-launch-environment) rel="packages/core/launch-environment" ;;
      dsh-client-ui-slots) rel="packages/core/client-ui-slots" ;;
      @types/node) rel="node_modules/@types/node" ;;
      *) echo "build: no checkout path for $name" >&2; return 1 ;;
    esac
  else
    rel="node_modules/@deepseek-ai/$name"
  fi
  local target="$DEP_NM/$rel"
  if [ ! -e "$target" ]; then
    echo "build: dependency target missing: $target" >&2
    return 1
  fi
  node -e "
    const fs = require('fs');
    const path = require('path');
    const link = path.resolve(process.argv[1]);
    const target = path.resolve(process.argv[2]);
    fs.rmSync(link, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  " "node_modules/$name" "$target"
}

echo "=== Linking build dependencies ==="
mkdir -p node_modules/@deepseek-ai
for name in cordis cosmokit schemastery dsh-llm dsh-settings dsh-timeout dsh-anonymous-user-id dsh-home-paths dsh-brand dsh-launch-environment dsh-client-ui-slots @types/node; do
  link_pkg "$name" || true
done

# @standard-schema/spec (schemastery type resolution)
STD_SCHEMA="$DEP_NM/node_modules/@standard-schema/spec"
if [ -e "$STD_SCHEMA" ]; then
  node -e "
    const fs = require('fs');
    const path = require('path');
    const link = path.resolve('node_modules/@standard-schema/spec');
    const target = path.resolve(process.argv[1]);
    fs.rmSync(path.resolve('node_modules/@standard-schema'), { recursive: true, force: true });
    fs.mkdirSync(path.resolve('node_modules/@standard-schema'), { recursive: true });
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  " "$STD_SCHEMA"
fi

echo "=== Compiling src → lib ==="
"$TSC" -p tsconfig.json

# Client half: the injector expects a tsdown bundle (not bare tsc output).
if [ -f tsdown.config.ts ] && command -v npm >/dev/null 2>&1; then
  echo "=== Building client bundle (tsdown + __ModuleLoader__ wrap) ==="
  npm run build:client 2>/dev/null || true
  node scripts/bundle-client.mjs 2>/dev/null || true
  if [ -f "lib/client.js" ] && grep -q "__ModuleLoader__" "lib/client.js"; then
    echo "client bundle OK (tsdown)"
  else
    echo "client bundle MISSING __ModuleLoader__ — run: npm run build:client" >&2
  fi
fi
echo "=== Build complete ==="
ls lib/ | head -20
