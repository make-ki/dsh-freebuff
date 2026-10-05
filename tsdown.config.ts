import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/client.ts'],
  format: ['cjs'],
  platform: 'browser',
  // These modules come from DSH's injected client-module loader, not this bundle.
  deps: { neverBundle: ['react', /^@deepseek-ai\//] },
  target: 'es2022',
  outDir: 'lib',
  clean: false,
  outExtensions: () => ({ js: '.js' }),
  // tsc emits lib/types/client.d.ts; keep tsdown from double-emitting types.
  dts: false,
})
