import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { Store } from '../electron/store';
import { MediaStore } from '../electron/media';
import { parseCSV, defaultMapping, mapImport } from '../shared/csv';
import { imageReferences, MANAGED_IMAGE } from '../shared/images';
import {
  importCards,
  makeBackup,
  makeCSVArchive,
  readBackup,
  restoreBackup,
} from '../electron/transfers';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGKpWHCJgYGBiQEMAAAAAP//4Qn7GwAAAAZJREFUAwAW8gHxpvE3WAAAAABJRU5ErkJggg==',
  'base64',
);
const temp = () => mkdtempSync(path.join(tmpdir(), 'supercard-transfer-'));
test('media copied by content hash, path traversal and active formats rejected', () => {
  const media = new MediaStore(temp());
  const name = media.add(png);
  assert.match(name, MANAGED_IMAGE);
  assert.equal(media.add(png), name);
  assert.deepEqual(media.read(name), png);
  assert.throws(() => media.read('../secret'));
  assert.throws(() => media.add(Buffer.from('<svg onload="alert(1)"></svg>')));
  const missing = new Set<string>();
  media.resolve('<img src="../secret.png"><img src="https://example.com/x.png">', temp(), missing);
  assert.deepEqual([...missing], ['../secret.png', 'https://example.com/x.png']);
});
test('referenced image import reports missing files; CSV plus media and backups restore in a fresh database', () => {
  const root = temp(),
    source = temp();
  writeFileSync(path.join(source, 'diagram & one.png'), png);
  const store = new Store(root),
    media = new MediaStore(root);
  const parsed = parseCSV(
    'Front,Back,Tags\n"Question <img src=""diagram &amp; one.png"">","\\[x^2\\]<img src=""missing.png"">",math',
  );
  const result = importCards(store, media, parsed, defaultMapping(parsed), {
    deckName: 'Images',
    folder: source,
  });
  assert.equal(store.load().cards.length, 1);
  assert.ok(result.warnings.includes('Missing or unsupported image: missing.png'));
  const card = store.load().cards[0],
    ref = imageReferences(card.front)[0];
  assert.match(ref, MANAGED_IMAGE);
  assert.deepEqual(media.read(ref), png);
  const csvArchive = unzipSync(makeCSVArchive(store.load(), media).bytes);
  assert.deepEqual(Buffer.from(csvArchive[`media/${ref}`]), png);
  const roundTrip = parseCSV(strFromU8(csvArchive['cards.csv']));
  assert.equal(mapImport(roundTrip, defaultMapping(roundTrip)).cards[0].back, card.back);
  const backup = readBackup(makeBackup(store.load(), media).bytes);
  assert.equal(backup.images, 1);
  const dest = temp();
  let restored = new Store(dest);
  const restoredMedia = new MediaStore(dest);
  restoreBackup(restored, restoredMedia, backup);
  restored.close();
  restored = new Store(dest);
  assert.equal(restored.load().cards[0].front, card.front);
  assert.deepEqual(restoredMedia.read(ref), png);
  restoreBackup(restored, restoredMedia, backup);
  assert.equal(restored.load().decks.length, 2);
  assert.equal(restored.load().decks[1].name, 'Images (restored 1)');
  store.close();
  restored.close();
});
test('invalid archives reject unsafe paths, unsupported versions, corrupt images, and broken relationships', () => {
  assert.throws(() => readBackup(zipSync({ '../escape': strToU8('x') })));
  assert.throws(() =>
    readBackup(
      zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'supercard', version: 99 })) }),
    ),
  );
  const manifest = { format: 'supercard', version: 1, collection: { decks: [], cards: [] } };
  assert.throws(() =>
    readBackup(
      zipSync({
        'manifest.json': strToU8(JSON.stringify(manifest)),
        [`media/${'0'.repeat(64)}.png`]: png,
      }),
    ),
  );
  assert.throws(() =>
    readBackup(
      zipSync({
        'manifest.json': strToU8(
          JSON.stringify({
            ...manifest,
            collection: {
              decks: [],
              cards: [{ id: 'a', deckId: 'absent', front: 'x', back: 'y' }],
            },
          }),
        ),
      }),
    ),
  );
});
test('image reference extraction respects quoted attributes and HTML entities', () => {
  assert.deepEqual(
    imageReferences('<img alt="a > b" src="two &amp; three.png"><img src=bare.jpg>'),
    ['two & three.png', 'bare.jpg'],
  );
});
