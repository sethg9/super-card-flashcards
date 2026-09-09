import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { mkdirSync, mkdtempSync } from 'node:fs';
const root = path.resolve('.test-output');
mkdirSync(root, { recursive: true });

test('create, save, study, and persist after an Electron restart', async () => {
  const profile = mkdtempSync(path.join(root, 'profile-'));
  const launch = () =>
    electron.launch({ args: ['.'], env: { ...process.env, SUPERCARD_TEST_DATA: profile } });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.getByRole('button', { name: 'Create your first deck' }).click();
    await page.getByLabel('Deck name').fill('Calculus essentials');
    await page.getByRole('button', { name: 'Create deck', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Calculus essentials' })).toBeVisible();
    await page.getByRole('button', { name: 'Add card', exact: true }).click();
    await page.getByLabel('Front · Question').fill('What is the derivative of x²?');
    await page.getByLabel('Back · Answer').fill('2x');
    await page.getByRole('button', { name: 'Save card', exact: true }).click();
    await expect(page.locator('.card-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Study deck', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Flip card' })).toContainText(
      'What is the derivative',
    );
    await page.getByRole('button', { name: 'Flip card' }).click();
    await expect(page.locator('.study-face[aria-hidden=false] .card-content')).toHaveText('2x');
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: 'Calculus essentials' })).toBeVisible();
    await expect(page.locator('.card-row')).toHaveCount(1);
    await expect(page.locator('.card-row')).toContainText('2x');
    await page.screenshot({ path: path.join(root, 'first-milestone.png') });
    const security = await page.evaluate(() => ({
      node: typeof (window as any).require,
      bridge: Object.keys((window as any).supercard),
    }));
    expect(security.node).toBe('undefined');
    expect(security.bridge).not.toContain('invoke');
  } finally {
    await app.close();
  }
});

test('closing the window flushes an edit before the autosave timer fires', async () => {
  const profile = mkdtempSync(path.join(root, 'close-save-'));
  const launch = () =>
    electron.launch({ args: ['.'], env: { ...process.env, SUPERCARD_TEST_DATA: profile } });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.getByRole('button', { name: 'Create your first deck' }).click();
    await page.getByLabel('Deck name').fill('Save on close');
    await page.getByRole('button', { name: 'Create deck', exact: true }).click();
    await page.getByRole('button', { name: 'Add card', exact: true }).click();
    await page.getByLabel('Front · Question').fill('Immediate question');
    await page.getByLabel('Back · Answer').fill('Saved immediately before closing');
    const closed = app.waitForEvent('close');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await closed;
    app = await launch();
    page = await app.firstWindow();
    await expect(page.locator('.card-row')).toHaveCount(1);
    await expect(page.locator('.card-row')).toContainText('Saved immediately before closing');
  } finally {
    await app.close();
  }
});
