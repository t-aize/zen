import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node25',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: false,
  dts: false,
});
