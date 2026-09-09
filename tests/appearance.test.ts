import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../electron/store';
import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  accentVariables,
  contrast,
  type Theme,
} from '../shared/appearance';
test('appearance migration preserves legacy themes and explicit choices, rejecting invalid settings', () => {
  assert.equal(normalizeAppearance(null, 'dark').theme, 'dark');
  assert.equal(normalizeAppearance(null, 'dark').animateFlips, true);
  const choice = {
    ...DEFAULT_APPEARANCE,
    theme: 'oled',
    accent: '#000000',
    dimming: 0,
    animateFlips: true,
  };
  assert.deepEqual(normalizeAppearance(choice, 'light'), choice);
  const invalid = normalizeAppearance({
    theme: 'wrong',
    accent: 'url(file:///x)',
    background: '../x.png',
    dimming: NaN,
  });
  assert.deepEqual(invalid, DEFAULT_APPEARANCE);
});
test('arbitrary accents have readable text, filled-button labels, and focus colors across themes', () => {
  for (const theme of ['light', 'dark', 'oled'] as Theme[])
    for (const accent of [
      '#ffffff',
      '#000000',
      '#78f542',
      '#808080',
      '#ff0000',
      '#0000ff',
      '#ffff00',
      '#123456',
    ]) {
      const vars = accentVariables({ ...DEFAULT_APPEARANCE, theme, accent });
      const surface = vars['--surface'];
      for (const fill of ['--accent', '--accent-hover', '--accent-pressed'])
        assert.ok(contrast(vars[fill], vars['--accent-fg']) >= 4.5, `${theme}/${accent}/${fill}`);
      assert.ok(contrast(vars['--accent-text'], surface) >= 4.5);
      assert.ok(contrast(vars['--accent-text'], vars['--accent-soft']) >= 4.5);
      assert.ok(contrast(vars['--focus'], surface) >= 3);
      assert.ok(contrast(vars['--selection'], vars['--selection-fg']) >= 4.5);
      if (theme === 'oled') assert.equal(vars['--banner'], '#000000');
    }
});
test('settings table is additive and preferences persist without changing cards or decks', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'supercard-appearance-'));
  let store = new Store(root);
  const deck = store.createDeck('Synthetic preserved deck');
  store.saveCard({ deckId: deck.id, front: 'front', back: 'back', tags: '' });
  const before = store.load();
  const saved = {
    ...DEFAULT_APPEARANCE,
    theme: 'oled' as const,
    accent: '#123456',
    background: 'a'.repeat(64) + '.png',
    animateFlips: true,
  };
  store.saveAppearance(saved);
  store.close();
  store = new Store(root);
  assert.deepEqual(store.loadAppearance(), saved);
  assert.deepEqual(store.load(), before);
  store.close();
});

test('saved animation opt-out survives migration; dark tint follows accent and OLED stays black', () => {
  assert.equal(normalizeAppearance({ animateFlips: false }).animateFlips, false);
  assert.equal(normalizeAppearance({}).animateFlips, true);
  const green = accentVariables({ ...DEFAULT_APPEARANCE, theme: 'dark', accent: '#00ff00' });
  const red = accentVariables({ ...DEFAULT_APPEARANCE, theme: 'dark', accent: '#ff0000' });
  for (const key of ['--bg', '--sidebar', '--surface', '--hover', '--border'])
    assert.notEqual(green[key], red[key]);
  for (const accent of ['#ffffff', '#000000', '#ff0000']) {
    const oled = accentVariables({ ...DEFAULT_APPEARANCE, theme: 'oled', accent });
    for (const key of ['--bg', '--surface', '--sidebar', '--banner'])
      assert.equal(oled[key], '#000000');
  }
});
