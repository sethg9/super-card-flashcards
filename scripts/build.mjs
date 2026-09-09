import { build as bundle } from 'esbuild';
import { build } from 'vite';
import { copyAssets } from './assets.mjs';
await copyAssets();
await bundle({
  entryPoints: ['electron/main.ts', 'electron/preload.ts'],
  outdir: 'dist-electron',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
});
await build();
