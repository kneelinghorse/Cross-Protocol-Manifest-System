import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  dts: true,
  minify: false,
  treeshake: true,
  splitting: false,
  shims: false,
  noExternal: [/^@actions\//, '@proto/data'],
  env: {
    NODE_ENV: 'production'
  }
});
