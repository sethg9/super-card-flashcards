import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';

test('animated flips never introduce a page scrollbar in either study layout', async () => {
  const profile = mkdtempSync(path.resolve('.test-output/flip-overflow-'));
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SUPERCARD_TEST_DATA: profile },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.supercard);
    await page.evaluate(async () => {
      const deck = await window.supercard.createDeck('Flip overflow');
      await window.supercard.saveCard({ deckId: deck.id, front: 'Front', back: 'Back', tags: '' });
    });
    await page.reload();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const mode of ['Study deck', 'Learn deck']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      for (const focus of [false, true]) {
        if (focus) await page.getByRole('button', { name: 'Enter focus view' }).click();
        for (const [width, height] of [
          [800, 600],
          [1800, 1080],
        ]) {
          await page.setViewportSize({ width, height });
          for (let flip = 0; flip < 2; flip++) {
            const overflow = await page.evaluate(async () => {
              let x = 0,
                y = 0;
              (document.querySelector('.study-face[aria-hidden="false"]') as HTMLElement).click();
              const start = performance.now();
              while (performance.now() - start < 400) {
                await new Promise(requestAnimationFrame);
                x = Math.max(x, document.documentElement.scrollWidth - innerWidth);
                y = Math.max(y, document.documentElement.scrollHeight - innerHeight);
              }
              return { x, y };
            });
            expect(overflow, `${mode}; focus=${focus}; ${width}×${height}`).toEqual({ x: 0, y: 0 });
          }
        }
      }
      await page
        .getByRole('button', {
          name: mode === 'Study deck' ? 'Back to deck' : 'Exit Learn',
          exact: true,
        })
        .click();
    }
  } finally {
    await app.close();
  }
});

test('native maximize and live font changes preserve the visible side', async () => {
  const profile = mkdtempSync(path.resolve('.test-output/native-sizing-'));
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SUPERCARD_TEST_DATA: profile },
  });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1000, height: 650 }),
    );
    await page.waitForFunction(() => !!window.supercard);
    await page.evaluate(async () => {
      const deck = await window.supercard.createDeck('Native resize');
      await window.supercard.saveCard({
        deckId: deck.id,
        front: 'Question',
        back: 'Answer',
        tags: '',
      });
    });
    await page.reload();
    await page.getByRole('button', { name: 'Study deck', exact: true }).click();
    await page.getByRole('button', { name: 'Flip card', exact: true }).click();
    const font = () =>
      page
        .locator('.study-back .card-content')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const before = await font();
    const navigationFont = await page
      .getByRole('button', { name: 'Back to deck' })
      .evaluate((el) => getComputedStyle(el).fontSize);
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByLabel('Card font size', { exact: true }).focus();
    await page.keyboard.press('End');
    await expect.poll(font).toBeGreaterThan(before);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Back to deck' })).toHaveCSS(
      'font-size',
      navigationFont,
    );
    const oldHeight = (await page.locator('.study-card').boundingBox())!.height;
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
    await expect
      .poll(() => page.locator('.study-card').evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(oldHeight);
    await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize());
    await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
  } finally {
    await app.close();
  }
});

test('study area sizing, font preferences, internal scrolling and session state', async () => {
  const profile = mkdtempSync(path.resolve('.test-output/study-sizing-'));
  const launch = () =>
    electron.launch({ args: ['.'], env: { ...process.env, SUPERCARD_TEST_DATA: profile } });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.waitForFunction(() => !!window.supercard);
    await page.evaluate(async () => {
      const d = await window.supercard.createDeck('Sizing examples');
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 400;
      canvas.getContext('2d')!.fillRect(0, 0, 800, 400);
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!)));
      const image = await window.supercard.addImage(new Uint8Array(await blob.arrayBuffer()));
      for (let i = 0; i < 2; i++)
        await window.supercard.saveCard({
          deckId: d.id,
          front: '<h2>Question</h2>\\(x^2+1\\)',
          back: `<img src="${image}">\\[\\frac{1}{2}\\]\n` + 'Readable line\n'.repeat(80),
          tags: '',
        });
    });
    await page.reload();
    await page.getByRole('button', { name: 'New deck', exact: true }).click();
    await expect(page.getByLabel('Deck name', { exact: true })).toHaveCSS('font-size', '12px');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(page.getByLabel('Card font size', { exact: true })).toHaveValue('25');
    await page.getByLabel('Card font size', { exact: true }).evaluate((el: HTMLInputElement) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '32');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    for (const mode of ['Study deck', 'Learn deck']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await page.getByRole('button', { name: 'Flip card', exact: true }).click();
      let previousHeight = 0;
      let previousFont = 0;
      for (const [width, height] of [
        [800, 600],
        [1200, 800],
        [1800, 1080],
      ]) {
        await page.setViewportSize({ width, height });
        await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
        await expect
          .poll(() =>
            page.locator('.study-card').evaluate((el) => el.getBoundingClientRect().height),
          )
          .toBeGreaterThan(previousHeight);
        previousHeight = (await page.locator('.study-card').boundingBox())!.height;
        const font = await page
          .locator('.study-back .card-content')
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(font).toBeGreaterThan(previousFont);
        expect(font).toBeLessThanOrEqual(38.4);
        previousFont = font;
        const controls = await page
          .locator(mode === 'Learn deck' ? '.learn-actions' : '.study-controls')
          .boundingBox();
        expect(controls!.y + controls!.height).toBeLessThanOrEqual(height);
        expect(
          await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
        ).toBe(true);
        expect(
          await page
            .locator('.study-back .study-scroll')
            .evaluate((el) => el.scrollHeight > el.clientHeight),
        ).toBe(true);
      }
      await page.getByRole('button', { name: 'Enter focus view' }).click();
      await expect(page.locator('.sidebar')).toBeHidden();
      await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
      await expect(page.locator('.study-back mjx-container')).toBeVisible();
      await expect(page.locator('.study-back img')).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await page.screenshot({ path: `.test-output/sizing-content-${mode.split(' ')[0]}.png` });
      await page.locator('.study-back .study-scroll').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect(
        await page.locator('.study-back .study-scroll').evaluate((el) => el.scrollTop),
      ).toBeGreaterThan(0);
      await page.screenshot({ path: `.test-output/sizing-${mode.split(' ')[0]}.png` });
      await page.keyboard.press('Escape');
      if (mode === 'Learn deck') {
        await page.getByRole('button', { name: 'Know it, Right arrow' }).click();
        await expect(page.locator('.study-progress')).toContainText('Card 2 of 2');
        await page.setViewportSize({ width: 800, height: 600 });
        await expect(page.locator('.study-progress')).toContainText('Card 2 of 2');
        await page.getByRole('button', { name: 'Know it, Right arrow' }).click();
        await expect(page.locator('.learn-summary')).toContainText('2 learned');
        await page.getByRole('button', { name: 'Return to library' }).click();
      } else await page.getByRole('button', { name: 'Back to deck' }).click();
    }
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(page.getByLabel('Card font size', { exact: true })).toHaveValue('32');
    await page.getByRole('button', { name: 'Reset card font size', exact: true }).click();
    await expect(page.getByLabel('Card font size', { exact: true })).toHaveValue('25');
  } finally {
    await app.close();
  }
});
