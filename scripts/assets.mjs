import { cp, mkdir } from 'node:fs/promises';
export async function copyAssets() {
  await mkdir('public', { recursive: true });
  await cp('node_modules/mathjax', 'public/mathjax', { recursive: true });
  await cp('node_modules/@mathjax/mathjax-newcm-font', 'public/mathjax-newcm-font', {
    recursive: true,
  });
}
