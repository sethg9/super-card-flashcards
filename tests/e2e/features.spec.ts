import { syntheticCSV } from '../fixtures/synthetic';
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import path from 'node:path';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
const root = path.resolve('.test-output');
mkdirSync(root, { recursive: true });
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGKpWHCJgYGBiQEMAAAAAP//4Qn7GwAAAAZJREFUAwAW8gHxpvE3WAAAAABJRU5ErkJggg==',
  'base64',
);
async function openFile(app: ElectronApplication, file: string) {
  await app.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [chosen] })) as any;
  }, file);
}
async function saveFile(app: ElectronApplication, file: string) {
  await app.evaluate(({ dialog }, chosen) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: chosen })) as any;
  }, file);
}
test('sample import, offline MathJax, search, themes, shuffle and CSV/backup UI', async () => {
  const profile = mkdtempSync(path.join(root, 'features-'));
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SUPERCARD_TEST_DATA: profile },
  });
  try {
    const page = await app.firstWindow();
    const external: string[] = [];
    page.on('request', (req) => {
      if (/^https?:/.test(req.url())) external.push(req.url());
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('renderer:', msg.text());
    });
    await page.context().setOffline(true);
    const fixture = path.join(profile, 'synthetic.csv');
    writeFileSync(fixture, syntheticCSV);
    await openFile(app, fixture);
    await page.getByRole('button', { name: 'Import CSV / TSV' }).click();
    await expect(page.getByRole('dialog', { name: 'Import flashcards' })).toBeVisible();
    await expect(page.getByLabel('Front column')).toHaveValue('0');
    await page.getByLabel('New deck name').fill('Calculus essentials');
    await expect(page.locator('.import-preview mjx-container').first()).toBeVisible({
      timeout: 25_000,
    });
    await page.getByRole('button', { name: 'Import 84 cards', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Transfer complete' })).toContainText(
      'Imported 84 cards',
    );
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.card-row')).toHaveCount(50);
    await expect(page.locator('.card-row mjx-container').first()).toBeVisible();
    await page.screenshot({ path: path.join(root, 'library-light.png') });
    await page.getByPlaceholder('Search cards or tags').fill('Searchable synthetic question');
    await expect(page.locator('.card-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Clear search' }).click();
    await page.getByRole('button', { name: 'Study deck', exact: true }).click();
    await expect(page.locator('.study-face[aria-hidden=false] mjx-container')).toBeVisible();
    await page.locator('body').click({ position: { x: 245, y: 5 } });
    await page.keyboard.press('Space');
    await expect(page.locator('.study-face[aria-hidden=false] .side-label')).toContainText('BACK');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.study-progress')).toContainText('Card 2 of 84');
    await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
    await expect(page.locator('.study-progress')).toContainText('Card 1 of 84');
    await page.getByRole('button', { name: 'Next card' }).click();
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect(page.locator('.study-progress')).toContainText('Card 1 of 84');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.study-face[aria-hidden=false]')).toHaveCSS(
      'background-color',
      'rgb(30, 33, 48)',
    );
    await page.screenshot({ path: path.join(root, 'study-dark.png') });
    await page.getByRole('button', { name: 'Back to deck' }).click();
    const csvFile = path.join(profile, 'export.zip');
    await saveFile(app, csvFile);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Transfer complete' })).toContainText(
      'Saved export.zip',
    );
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    expect(existsSync(csvFile)).toBe(true);
    const backup = path.join(profile, 'library.supercard');
    await saveFile(app, backup);
    await page.getByRole('button', { name: 'Back up library' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await openFile(app, backup);
    await page.getByRole('button', { name: 'Restore backup', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Restore backup' })).toContainText('84 cards');
    await page.getByRole('button', { name: 'Restore library' }).click();
    await expect(page.getByRole('dialog', { name: 'Transfer complete' })).toContainText(
      'Restored 1 decks and 84 cards',
    );
    expect(external).toEqual([]);
  } finally {
    await app.close();
  }
});

test('autosave, display math, image file/drop/paste, and malicious HTML isolation', async () => {
  const profile = mkdtempSync(path.join(root, 'media-ui-'));
  const imagePath = path.join(profile, 'pixel.png');
  writeFileSync(imagePath, png);
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SUPERCARD_TEST_DATA: profile },
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Create your first deck' }).click();
    await page.getByLabel('Deck name').fill('Visual notebook');
    await page.getByRole('button', { name: 'Create deck', exact: true }).click();
    await page.getByRole('button', { name: 'Add card', exact: true }).click();
    await page
      .getByLabel('Front · Question')
      .fill('\\[\\int_0^1 x^2\\,dx = \\frac{1}{3}\\] and \\(x<y\\)');
    await page
      .getByLabel('Back · Answer')
      .fill(
        '<b>Safe formatting</b><script>window.pwned = true</script><img src="https://evil.invalid/a" onerror="window.pwned=true"><iframe src="file:///C:/Windows/win.ini"></iframe> \\(\\mathbb{R} \\mathfrak{A}\\)',
      );
    await expect(page.locator('.preview mjx-container[display="true"]')).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByRole('status')).toContainText('All changes saved');
    await openFile(app, imagePath);
    await page.getByRole('button', { name: 'Add image', exact: true }).first().click();
    await expect(page.locator('.preview img[src^="supercard-media:"]')).toHaveCount(1);
    const transfer = await page.evaluateHandle(
      (bytes) => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(bytes)], 'drop.png', { type: 'image/png' }));
        return dt;
      },
      [...png],
    );
    await page.locator('.editor-side').last().dispatchEvent('drop', { dataTransfer: transfer });
    await expect(page.locator('.preview img[src^="supercard-media:"]')).toHaveCount(2);
    await app.evaluate(
      async ({ clipboard, ClipboardItem }, bytes) => {
        (globalThis as any).__previousClipboard = await Promise.all(
          (await clipboard.read()).map(
            async (item) =>
              new ClipboardItem(
                Object.fromEntries(
                  await Promise.all(
                    item.types.map(async (type) => [type, await item.getType(type)]),
                  ),
                ),
              ),
          ),
        );
        await clipboard.write([
          new ClipboardItem({
            'image/png': new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
          }),
        ]);
      },
      [...png],
    );
    await page.getByLabel('Back · Answer').focus();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Control+V');
    await expect(page.locator('.preview img[src^="supercard-media:"]')).toHaveCount(3);
    await app.evaluate(async ({ clipboard }) => {
      const previous = (globalThis as any).__previousClipboard;
      if (previous?.length) await clipboard.write(previous);
      else clipboard.clear();
      delete (globalThis as any).__previousClipboard;
    });
    const isolation = await page.evaluate(() => ({
      pwned: (window as any).pwned,
      require: typeof (window as any).require,
      active: document.querySelectorAll('.preview script, .preview iframe, .preview [onerror]')
        .length,
    }));
    expect(isolation).toEqual({ pwned: undefined, require: 'undefined', active: 0 });
    const imageLoaded = await page
      .locator('.preview img[src^="supercard-media:"]')
      .first()
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(imageLoaded).toBe(true);
    await page.screenshot({ path: path.join(root, 'editor-math-images.png') });
    await page.getByRole('button', { name: 'Save card', exact: true }).click();
    await expect(page.locator('.card-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Edit card 1', exact: true }).click();
    await page.getByLabel('Back · Answer').fill('Automatic save without clicking Save');
    await expect(page.getByRole('status')).toContainText('All changes saved');
    const data = await page.evaluate(() => window.supercard.load());
    expect(data.cards[0].back).toBe('Automatic save without clicking Save');
  } finally {
    await app.close();
  }
});
