import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { imageDimensions } from '../../electron/image-dimensions';

test('48 MP backgrounds become bounded copies; neutral fade follows themes and survives restart', async () => {
  const profile = mkdtempSync(path.resolve('.test-output/polish-background-'));
  const launch = () =>
    electron.launch({ args: ['.'], env: { ...process.env, SUPERCARD_TEST_DATA: profile } });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    const source = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 8000;
      canvas.height = 6000;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fa8a25';
      ctx.fillRect(0, 0, 8000, 6000);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    const file = path.join(profile, '48mp.png');
    const original = Buffer.from(source, 'base64');
    writeFileSync(file, original);
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as any;
    }, file);
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('button', { name: 'Choose image', exact: true }).click();
    await expect(page.locator('.app-wallpaper img')).toBeVisible();
    const background = await page.evaluate(
      async () => (await window.supercard.loadAppearance())!.background!,
    );
    const size = imageDimensions(readFileSync(path.join(profile, 'media', background)), 'png');
    expect(size).toEqual({ width: 3840, height: 2880 });
    expect(readFileSync(file).equals(original)).toBe(true);
    await page.getByLabel('Background fade').evaluate((el: HTMLInputElement) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '75');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    for (const theme of ['Dark', 'OLED Black', 'Light']) {
      await page.getByRole('button', { name: theme, exact: true }).click();
      const color = theme === 'Light' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)';
      await expect(page.locator('.app-wallpaper > div')).toHaveCSS('background-color', color);
      await expect(page.locator('.background-dimmer')).toHaveCSS('background-color', color);
      await expect(page.locator('.app-wallpaper > div')).toHaveCSS('opacity', '0.75');
    }
    await expect(page.locator('.modal-backdrop')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0.4)',
    );
    const invalid = path.join(profile, 'unsupported.heic');
    writeFileSync(invalid, 'not a supported HEIC image');
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as any;
    }, invalid);
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    await expect(page.getByRole('alert').last()).toContainText('Supported images');
    await expect(page.getByRole('alert').last()).not.toContainText('200 MB');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(page.locator('.app-wallpaper > div')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await expect(page.locator('.app-wallpaper > div')).toHaveCSS('opacity', '0.75');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByLabel('Background fade').evaluate((el: HTMLInputElement) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '0');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('.app-wallpaper > div')).toHaveCSS('opacity', '0');
  } finally {
    await app.close();
  }
});

test('polished actions and focus view preserve Study and Learn state and accessible controls', async () => {
  const profile = mkdtempSync(path.resolve('.test-output/polish-study-'));
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SUPERCARD_TEST_DATA: profile },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.supercard);
    await page.evaluate(async () => {
      const deck = await window.supercard.createDeck('UI examples');
      for (let i = 1; i <= 2; i++)
        await window.supercard.saveCard({
          deckId: deck.id,
          front: `Question ${i}`,
          back: `Answer ${i}`,
          tags: '',
        });
    });
    await page.reload();
    await expect(page.locator('.topbar')).toHaveCount(0);
    for (const theme of ['Light', 'Dark', 'OLED Black']) {
      await page.getByRole('button', { name: 'Appearance', exact: true }).click();
      await page.getByRole('button', { name: theme, exact: true }).click();
      await page.getByLabel('Accent hex color').fill('#cf7821');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      for (const name of ['Study deck', 'Learn deck']) {
        await expect(page.getByRole('button', { name, exact: true })).toHaveCSS(
          'background-color',
          'rgb(207, 120, 33)',
        );
      }
      await expect(page.locator('.action-or')).toHaveCSS('letter-spacing', '1.5px');
    }
    await page.setViewportSize({ width: 780, height: 800 });
    const positions = await page
      .locator('.study-banner > *')
      .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().x));
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: '.test-output/polish-deck-small.png' });
    for (const mode of ['Study deck', 'Learn deck']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await page.getByRole('button', { name: 'Flip card', exact: true }).click();
      await page.getByRole('button', { name: 'Enter focus view' }).click();
      await expect(page.locator('.sidebar')).toBeHidden();
      await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
      await page.evaluate(() => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.id = 'test-overlay';
        document.body.append(dialog);
      });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Exit focus view' })).toBeVisible();
      await page.evaluate(() => document.getElementById('test-overlay')!.remove());
      await page.keyboard.press('Escape');
      await expect(page.locator('.sidebar')).toBeVisible();
      await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
      await page.getByRole('button', { name: 'Enter focus view' }).click();
      await page.keyboard.press('Tab');
      await page.getByRole('button', { name: 'Flip card', exact: true }).focus();
      await expect(page.getByRole('button', { name: 'Flip card', exact: true })).toHaveCSS(
        'outline-style',
        'solid',
      );
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.study-progress')).toContainText('Card 2 of 2');
      await expect(page.locator('.study-front')).toHaveAttribute('aria-hidden', 'false');
      if (mode === 'Learn deck') {
        await expect(page.locator('.learn-stage')).toBeFocused();
        await expect(page.locator('.learn-stage')).toHaveCSS('outline-style', 'none');
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('heading', { name: 'You know every card!' })).toBeVisible();
        await expect(page.locator('.learn-summary h2')).toHaveCSS('outline-style', 'none');
        await expect(page.locator('.learn-feedback')).toHaveCount(0);
        await page.screenshot({ path: '.test-output/polish-focus-complete.png' });
        await page.getByRole('button', { name: 'Return to library' }).click();
      } else await page.getByRole('button', { name: 'Back to deck' }).click();
      await expect(page.locator('.sidebar')).toBeVisible();
    }
    expect((await page.evaluate(() => window.supercard.load())).cards).toHaveLength(2);
  } finally {
    await app.close();
  }
});
