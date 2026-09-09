// Exercise the packaged executable using synthetic data in an isolated profile.
const { spawn } = require('node:child_process');
const { mkdirSync, mkdtempSync, existsSync, unlinkSync, readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const output = path.resolve('.test-output');
mkdirSync(output, { recursive: true });
const profile = mkdtempSync(path.join(output, 'packaged-profile-'));
const executable = path.resolve(
  process.env.SUPERCARD_SMOKE_EXE || 'release/win-unpacked/SuperCard.exe',
);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGKpWHCJgYGBiQEMAAAAAP//4Qn7GwAAAAZJREFUAwAW8gHxpvE3WAAAAABJRU5ErkJggg==',
  'base64',
);
async function run(reopen) {
  const transferResult = path.join(profile, 'transfer-result.json');
  const portFile = path.join(profile, 'DevToolsActivePort');
  if (existsSync(portFile)) unlinkSync(portFile);
  if (existsSync(transferResult)) unlinkSync(transferResult);
  const child = spawn(executable, ['--remote-debugging-port=0'], {
    windowsHide: true,
    env: { ...process.env, SUPERCARD_TEST_DATA: profile, SUPERCARD_SMOKE_TRANSFERS: '1' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let browser;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const poll = setInterval(() => {
        if (!existsSync(portFile)) return;
        const [port, endpoint] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
        if (port && endpoint) {
          clearInterval(poll);
          clearTimeout(timer);
          resolve(`ws://127.0.0.1:${port}${endpoint}`);
        }
      }, 100);
      const timer = setTimeout(() => {
        clearInterval(poll);
        reject(new Error('Packaged app startup timed out'));
      }, 60000);
      let log = '';
      child.stderr.on('data', (chunk) => {
        log += chunk.toString();
        const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve(match[1]);
        }
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        clearInterval(poll);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        clearInterval(poll);
        reject(new Error(`Early exit: ${code}`));
      });
    });
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    await context.setOffline(true);
    const externalRequests = [];
    await context.route(/^https?:/, (route) => {
      externalRequests.push(route.request().url());
      return route.abort();
    });
    const page = context.pages()[0] || (await context.waitForEvent('page'));
    await page.waitForFunction(() => !!window.supercard);
    await page.getByRole('button', { name: 'About & storage' }).click();
    await page
      .getByRole('heading', { name: `SuperCard ${require('../package.json').version}` })
      .waitFor();
    await page.getByRole('button', { name: 'Close about' }).click();
    assert.equal(path.resolve(await page.evaluate(() => window.supercard.dataPath())), profile);
    if (!reopen) {
      await page.evaluate(
        async (bytes) => {
          const initial = await window.supercard.load();
          if (initial.cards.length || initial.decks.length) throw new Error('Profile is not empty');
          const deck = await window.supercard.createDeck('Packaged offline check');
          const image = await window.supercard.addImage(new Uint8Array(bytes));
          await window.supercard.saveCard({
            deckId: deck.id,
            front: `Inline \\(x^2+1\\) <img src="${image}">`,
            back: '\\[\\frac{1}{2}+\\sqrt{4}\\]',
            tags: 'synthetic',
          });
          await window.supercard.saveAppearance({
            version: 1,
            theme: 'oled',
            accent: '#78f542',
            background: image,
            dimming: 0.65,
            animateFlips: true,
          });
        },
        [...png],
      );
    }
    await page.reload();
    await page.getByRole('button', { name: 'Study deck', exact: true }).click();
    await page.locator('.study-front mjx-container svg').first().waitFor();
    await page.waitForFunction(() => {
      const img = document.querySelector('.study-front img');
      return img?.complete && img.naturalWidth > 0;
    });
    await page.getByRole('button', { name: 'Flip card', exact: true }).click();
    await page.locator('.study-back[aria-hidden=false] mjx-container svg').first().waitFor();
    const result = await page.evaluate(async () => {
      const resources = await Promise.all(
        [
          '/mathjax/startup.js',
          '/mathjax/input/tex-base.js',
          '/mathjax/output/svg.js',
          '/mathjax-newcm-font/svg.js',
        ].map(async (url) => ({ url, ok: (await fetch(url)).ok })),
      );
      const collection = await window.supercard.load();
      return {
        decks: collection.decks.length,
        cards: collection.cards.length,
        nodeIntegration: typeof window.require,
        resources,
        theme: document.documentElement.dataset.theme,
        mathErrors: document.querySelectorAll('[data-mml-node="merror"], mjx-merror').length,
      };
    });
    const deadline = Date.now() + 30000;
    while (!existsSync(transferResult) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 100));
    const transfers = JSON.parse(readFileSync(transferResult, 'utf8'));
    assert.deepEqual(transfers, {
      csvImport: true,
      csvExport: true,
      backupExport: true,
      backupRestore: true,
    });
    assert.equal(result.nodeIntegration, 'undefined');
    assert.equal(result.decks, 1);
    assert.equal(result.cards, 1);
    assert.equal(result.theme, 'oled');
    assert.equal(result.mathErrors, 0);
    assert.ok(result.resources.every((r) => r.ok));
    assert.deepEqual(externalRequests, []);
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    await page.screenshot({
      path: path.join(output, `packaged-${reopen ? 'reopened' : 'offline'}.png`),
    });
    console.log(
      JSON.stringify(
        { reopen, offline: true, isolatedProfile: true, transfers, ...result },
        null,
        2,
      ),
    );
    const exited = new Promise((resolve) => child.once('exit', resolve));
    await page.evaluate(() => window.supercard.finishClose()).catch(() => {});
    await Promise.race([
      exited,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Close timed out')), 10000)),
    ]);
  } finally {
    await browser?.close().catch(() => {});
    if (child.exitCode === null) child.kill();
  }
}
(async () => {
  await run(false);
  await run(true);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
