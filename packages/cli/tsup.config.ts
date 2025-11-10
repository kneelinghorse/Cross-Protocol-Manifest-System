import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/proto.js'],
  target: 'node20',
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: false,
  minify: false
});
