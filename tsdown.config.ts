import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/client.ts'],
  format: ['cjs'],
  target: 'es2022',
  outDir: 'lib',
  clean: false,
  outExtension: () => ({ js: '.js' }),
  // tsc emits lib/types/client.d.ts; keep tsdown from double-emitting types.
  dts: false,
})
