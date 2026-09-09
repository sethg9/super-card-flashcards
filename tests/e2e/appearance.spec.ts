import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve('.test-output');
mkdirSync(root, { recursive: true });
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGKpWHCJgYGBiQEMAAAAAP//4Qn7GwAAAAZJREFUAwAW8gHxpvE3WAAAAABJRU5ErkJggg==',
  'base64',
);
test('appearance, managed backgrounds, contrast extremes, flips and restart persistence', async () => {
  const profile = mkdtempSync(path.join(root, 'appearance-ui-'));
  const launch = () =>
    electron.launch({ args: ['.'], env: { ...process.env, SUPERCARD_TEST_DATA: profile } });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Animate card flips' })).not.toBeChecked();
    await expect(page.getByLabel('Accent hex color')).toHaveValue('#78f542');
    for (const theme of ['Light', 'Dark', 'OLED Black']) {
      await page.getByRole('button', { name: theme, exact: true }).click();
      for (const accent of ['#ffffff', '#000000']) {
        await page.getByLabel('Accent hex color').fill(accent);
        await expect(page.getByRole('button', { name: 'Preview button' })).toHaveCSS(
          'color',
          accent === '#ffffff' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)',
        );
        await expect(page.getByRole('button', { name: 'Preview button' })).toHaveCSS(
          'background-color',
          accent === '#ffffff' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)',
        );
      }
    }
    await page.getByRole('button', { name: 'Reset to default' }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    const file = path.join(profile, 'synthetic-background.png');
    writeFileSync(file, png);
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as any;
    }, file);
    await page.getByRole('button', { name: 'Choose image', exact: true }).click();
    await expect(page.locator('.app-wallpaper img')).toBeVisible();
    await expect(page.locator('.app-wallpaper img')).toHaveCSS('object-fit', 'cover');
    const background = await page.evaluate(
      async () => (await window.supercard.loadAppearance())?.background,
    );
    await expect.poll(() => existsSync(path.join(profile, 'media', background!))).toBe(true);
    unlinkSync(file);
    const invalid = path.join(profile, 'invalid.svg');
    writeFileSync(invalid, '<svg><script>bad()</script></svg>');
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as any;
    }, invalid);
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    await expect(page.getByRole('alert').last()).toContainText(/image|Image|Supported/);
    await page.getByLabel('Background dimming').evaluate((el: HTMLInputElement) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '35');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByRole('switch', { name: 'Animate card flips' }).check();
    await page.screenshot({ path: path.join(root, 'appearance-oled.png') });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(page.getByRole('button', { name: 'OLED Black' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByLabel('Background dimming')).toHaveValue('35');
    await expect(page.getByRole('switch', { name: 'Animate card flips' })).toBeChecked();
    await expect
      .poll(() =>
        page
          .locator('.app-wallpaper img')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    await page.getByRole('button', { name: 'Remove image' }).click();
    await expect(page.locator('.app-wallpaper')).toHaveCount(0);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.evaluate(
      async (bytes) => {
        const d = await window.supercard.createDeck('Synthetic motion deck');
        const image = await window.supercard.addImage(new Uint8Array(bytes));
        await window.supercard.saveCard({
          deckId: d.id,
          front: `Inline \\(x<y\\) <img src="${image}">`,
          back:
            '\\[\\frac{1}{2}\\]\n' +
            Array.from({ length: 100 }, (_, i) => `Long example line ${i + 1}`).join('\n'),
          tags: '',
        });
        await window.supercard.saveCard({
          deckId: d.id,
          front: 'Second synthetic card',
          back: 'Second answer',
          tags: '',
        });
      },
      [...png],
    );
    await page.reload();
    await page.getByRole('button', { name: 'Study deck', exact: true }).click();
    await expect(page.locator('.study-face[aria-hidden=false] mjx-container')).toBeVisible();
    await expect(page.locator('.study-face[aria-hidden=false] img')).toBeVisible();
    await expect(page.locator('.flip-rotor')).toHaveCSS('transition-duration', '0.3s');
    await page.getByRole('button', { name: 'Flip card', exact: true }).click();
    await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('.study-front')).toHaveAttribute('inert', '');
    await expect(page.locator('.study-back')).toHaveCSS('backface-visibility', 'hidden');
    await expect(page.locator('.study-back mjx-container')).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('.study-back .study-scroll')
          .evaluate((el) => el.scrollHeight > el.clientHeight),
      )
      .toBe(true);
    await page.locator('.study-back .study-scroll').focus();
    await page.keyboard.press('PageDown');
    await expect
      .poll(() => page.locator('.study-back .study-scroll').evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Flip card', exact: true }).focus();
    for (let i = 0; i < 8; i++) await page.keyboard.press('Space');
    await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.study-front')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('button', { name: 'Flip card' })).toContainText(
      'Second synthetic card',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.flip-rotor')).toHaveCSS('transition-duration', '0s');
    await page.keyboard.press('Space');
    await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
    await page.screenshot({ path: path.join(root, 'oled-study.png') });
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('switch', { name: 'Animate card flips' }).uncheck();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('.flip-rotor')).toHaveCSS('transition-duration', '0s');
  } finally {
    await app.close();
  }
});
