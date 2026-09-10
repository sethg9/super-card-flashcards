import { test, expect, _electron as electron } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve('.test-output');
mkdirSync(root, { recursive: true });
test('Learn rounds, classification guards, math/images, keyboard isolation and original Flashcards', async () => {
  const profile = mkdtempSync(path.join(root, 'learn-'));
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SUPERCARD_TEST_DATA: profile },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.supercard);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGKpWHCJgYGBiQEMAAAAAP//4Qn7GwAAAAZJREFUAwAW8gHxpvE3WAAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.evaluate(
      async (bytes) => {
        const deck = await window.supercard.createDeck('Learn examples');
        const img = await window.supercard.addImage(new Uint8Array(bytes));
        await window.supercard.saveCard({
          deckId: deck.id,
          front: `Question \\(x^2\\) <img src="${img}">`,
          back: '\\[2^3=8\\]\n' + Array.from({ length: 90 }, (_, i) => `Line ${i}`).join('\n'),
          tags: '',
        });
        await window.supercard.saveCard({
          deckId: deck.id,
          front: 'Second question',
          back: 'Second answer',
          tags: '',
        });
      },
      [...png],
    );
    await page.reload();
    await page.getByRole('button', { name: 'Learn deck', exact: true }).click();
    await expect(page.locator('.study-front mjx-container').first()).toBeVisible();
    await expect(page.locator('.study-front img')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('.study-back')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('.study-back mjx-container').first()).toBeVisible();
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.down('ArrowLeft');
    await expect(page.locator('.learn-stage')).toHaveClass(/to-left/);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.study-progress')).toContainText('Card 2 of 2');
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.up('ArrowLeft');
    await expect(page.locator('.study-progress')).toContainText('Card 2 of 2');
    await expect(page.locator('.study-front')).toHaveAttribute('aria-hidden', 'false');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByLabel('Accent hex color').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.study-progress')).toContainText('Card 2 of 2');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Know it, Right arrow' }).click();
    await expect(page.getByRole('heading', { name: 'Round 1 complete' })).toBeVisible();
    await expect(page.locator('.learn-summary')).toContainText('1 learned · 1 still learning');
    await page.getByRole('button', { name: 'Review remaining cards' }).click();
    await expect(page.locator('.study-progress')).toContainText('Round 2 · Card 1 of 1');
    await expect(page.locator('.study-front')).toContainText('Question');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.study-front')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.learn-stage')).toHaveCSS('transform', 'none');
    await expect(page.getByRole('heading', { name: 'You know every card!' })).toBeVisible();
    await page.getByRole('button', { name: 'Study full deck again' }).click();
    await expect(page.locator('.study-progress')).toContainText('Round 1 · Card 1 of 2');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Study deck', exact: true }).click();
    await page.getByRole('button', { name: 'Flip card', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.study-progress')).toContainText('Card 2 of 2');
    expect((await page.evaluate(() => window.supercard.load())).cards).toHaveLength(2);
  } finally {
    await app.close();
  }
});
