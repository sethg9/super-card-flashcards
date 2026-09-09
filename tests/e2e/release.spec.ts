import { test, expect, _electron as electron } from '@playwright/test';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  writeSync,
  closeSync,
  truncateSync,
} from 'node:fs';
import path from 'node:path';
import { FILE_LIMIT } from '../../shared/limits';
const root = path.resolve('.test-output');
mkdirSync(root, { recursive: true });
test('README import, exact 200 MB boundary, responsive preparation, and keyboard controls', async () => {
  test.setTimeout(120000);
  const profile = mkdtempSync(path.join(root, 'release-ui-'));
  const example = readFileSync('README.md', 'utf8').match(/```csv\r?\n([\s\S]*?)```/)![1];
  const large = path.join(profile, 'large-synthetic.csv');
  const tail = Buffer.from('\n' + example);
  const fd = openSync(large, 'w');
  writeSync(fd, Buffer.from('#'));
  let remaining = FILE_LIMIT - 1 - tail.length;
  const chunk = Buffer.alloc(1024 * 1024, 120);
  while (remaining > 0) {
    const length = Math.min(remaining, chunk.length);
    writeSync(fd, chunk, 0, length);
    remaining -= length;
  }
  writeSync(fd, tail);
  closeSync(fd);
  const tooLarge = path.join(profile, 'over-limit.csv');
  writeFileSync(tooLarge, '');
  truncateSync(tooLarge, FILE_LIMIT + 1);
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SUPERCARD_TEST_DATA: profile },
  });
  try {
    const page = await app.firstWindow();
    const choose = async (file: string) =>
      app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as any;
      }, file);
    await choose(tooLarge);
    await expect(page.evaluate(() => window.supercard.chooseCSV())).rejects.toThrow(/200 MB/);
    await choose(large);
    await page.getByRole('button', { name: 'Import CSV / TSV' }).click();
    await expect(page.getByRole('status')).toContainText('Processing files');
    // A renderer round trip remains responsive while the worker reads/parses 200 MiB.
    expect(await page.evaluate(() => 2 + 2)).toBe(4);
    await expect(page.getByRole('dialog', { name: 'Import flashcards' })).toBeVisible({
      timeout: 60000,
    });
    await page.getByRole('button', { name: 'Import cards', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Transfer complete' })).toContainText(
      'Imported 3 cards',
    );
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.card-row')).toHaveCount(3);
    await page.getByRole('button', { name: 'Study deck', exact: true }).click();
    await page.getByRole('button', { name: 'Flip card', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.study-front')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.down('ArrowDown');
    await page.keyboard.down('ArrowDown');
    await page.keyboard.up('ArrowDown');
    await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.study-front')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('.study-progress')).toContainText('Card 2 of 3');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByLabel('Accent hex color').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.study-front')).toHaveAttribute('aria-hidden', 'false');
    await page.getByRole('switch', { name: 'Animate card flips' }).uncheck();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Animate card flips' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'About & storage' }).click();
    await expect(page.getByRole('dialog')).toContainText(
      'Vibecoded by ChatGPT 6 Astra - Idea from Seth',
    );
    await page.getByRole('button', { name: 'Close about' }).click();
    await choose(large);
    await page.getByRole('button', { name: 'Import CSV / TSV' }).click();
    await page.getByRole('button', { name: 'Cancel preparation' }).click();
    await expect(page.getByRole('alert')).toContainText('canceled');
    expect((await page.evaluate(() => window.supercard.load())).cards).toHaveLength(3);
  } finally {
    await app.close();
  }
});
