import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../electron/store';
test('SQLite persists Unicode and math, edits cards, and cascades deck deletion', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'supercard-store-'));
  let store = new Store(root);
  const deck = store.createDeck('微積分');
  const card = store.saveCard({
    deckId: deck.id,
    front: '\\(x^2\\)',
    back: '2x\n第二行',
    tags: 'math',
  });
  store.close();
  store = new Store(root);
  assert.deepEqual(store.load(), { decks: [deck], cards: [card] });
  store.saveCard({ ...card, back: 'changed' });
  assert.equal(store.load().cards[0].back, 'changed');
  store.deleteDeck(deck.id);
  assert.deepEqual(store.load(), { decks: [], cards: [] });
  store.close();
});
test('transaction failure rolls back and invalid cards cannot be saved', () => {
  const store = new Store(mkdtempSync(path.join(tmpdir(), 'supercard-tx-')));
  assert.throws(() =>
    store.transaction(() => {
      store.createDeck('rollback');
      throw new Error('failure');
    }),
  );
  assert.equal(store.load().decks.length, 0);
  assert.throws(() => store.saveCard({ deckId: 'missing', front: 'a', back: 'b', tags: '' }));
  assert.throws(() => store.createDeck(' '));
  store.close();
});
