import { context } from 'esbuild';

const isWatchMode = process.argv.includes('--watch');

const ctx = await context({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});

if (isWatchMode) {
  await ctx.watch();
  console.log('Watching src/index.ts...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
