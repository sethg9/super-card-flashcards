import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Card, CardInput, Collection, Deck } from '../shared/types';
import { normalizeAppearance } from '../shared/appearance';

export function textValue(value: unknown, label: string, max = 200_000): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error(`${label} must be text of at most ${max.toLocaleString()} characters.`);
  return value;
}
export class Store {
  db: DatabaseSync;
  constructor(public root: string) {
    mkdirSync(root, { recursive: true });
    this.db = new DatabaseSync(path.join(root, 'supercard.sqlite'));
    this.db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, deckId TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        front TEXT NOT NULL, back TEXT NOT NULL, tags TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS cards_deck ON cards(deckId);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version = 1;`);
  }
  load(): Collection {
    return {
      decks: this.db
        .prepare('SELECT * FROM decks ORDER BY createdAt, rowid')
        .all()
        .map((row) => ({ ...row })) as unknown as Deck[],
      cards: this.db
        .prepare('SELECT * FROM cards ORDER BY createdAt, rowid')
        .all()
        .map((row) => ({ ...row })) as unknown as Card[],
    };
  }
  loadAppearance() {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get('appearance');
    if (!row) return null;
    try {
      return normalizeAppearance(JSON.parse(String(row.value)));
    } catch {
      return null;
    }
  }
  saveAppearance(value: unknown) {
    const valid = normalizeAppearance(value);
    this.db
      .prepare(
        'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      )
      .run('appearance', JSON.stringify(valid));
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  createDeck(name: string): Deck {
    name = textValue(name, 'Deck name', 100).trim();
    if (!name) throw new Error('Give your deck a name.');
    const deck = { id: randomUUID(), name, createdAt: new Date().toISOString() };
    this.db.prepare('INSERT INTO decks VALUES (?, ?, ?)').run(deck.id, deck.name, deck.createdAt);
    return deck;
  }
  renameDeck(id: string, name: string) {
    name = textValue(name, 'Deck name', 100).trim();
    if (!name) throw new Error('Give your deck a name.');
    if (
      !this.db
        .prepare('UPDATE decks SET name = ? WHERE id = ?')
        .run(name, textValue(id, 'Deck ID', 100)).changes
    )
      throw new Error('Deck no longer exists.');
  }
  deleteDeck(id: string) {
    this.db.prepare('DELETE FROM decks WHERE id = ?').run(textValue(id, 'Deck ID', 100));
  }
  saveCard(input: CardInput): Card {
    if (!input || typeof input !== 'object') throw new Error('Invalid card.');
    const deckId = textValue(input.deckId, 'Deck ID', 100);
    const front = textValue(input.front, 'Front'),
      back = textValue(input.back, 'Back'),
      tags = textValue(input.tags, 'Tags', 10_000);
    if (!front.trim() || !back.trim()) throw new Error('Add something to both sides of the card.');
    const now = new Date().toISOString();
    if (input.id) {
      const id = textValue(input.id, 'Card ID', 100);
      if (
        !this.db
          .prepare('UPDATE cards SET front=?, back=?, tags=?, updatedAt=? WHERE id=? AND deckId=?')
          .run(front, back, tags, now, id, deckId).changes
      )
        throw new Error('Card no longer exists.');
      return this.db.prepare('SELECT * FROM cards WHERE id=?').get(id) as unknown as Card;
    }
    const card = { id: randomUUID(), deckId, front, back, tags, createdAt: now, updatedAt: now };
    this.db
      .prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(card.id, deckId, front, back, tags, now, now);
    return card;
  }
  deleteCard(id: string) {
    this.db.prepare('DELETE FROM cards WHERE id=?').run(textValue(id, 'Card ID', 100));
  }
  close() {
    this.db.close();
  }
}
