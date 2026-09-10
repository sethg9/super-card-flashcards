import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { FILE_LIMIT, checkFileSize } from '../shared/limits';
import { IMAGE_LIMIT } from '../shared/images';
import { parseCSV, defaultMapping, utf8Size } from '../shared/csv';
import { importCards } from '../electron/transfers';
import { Store } from '../electron/store';
import { MediaStore } from '../electron/media';
import { studyShortcut } from '../src/study-shortcuts';
test('200 MiB byte boundaries are inclusive and consistent for CSV/images', () => {
  assert.equal(FILE_LIMIT, 209715200);
  assert.equal(IMAGE_LIMIT, FILE_LIMIT);
  for (const size of [0, FILE_LIMIT - 1, FILE_LIMIT])
    assert.doesNotThrow(() => checkFileSize(size));
  for (const size of [-1, NaN, Infinity, FILE_LIMIT + 1]) assert.throws(() => checkFileSize(size));
  for (const source of ['abc', 'é東京🙂', '\ud800'])
    assert.equal(utf8Size(source), Buffer.byteLength(source));
});
test('Wiki CSV example imports through the real database path', () => {
  const example = readFileSync('docs/wiki/CSV-import-and-export.md', 'utf8').match(
    /```csv\r?\n([\s\S]*?)```/,
  )![1];
  const parsed = parseCSV(example),
    mapping = defaultMapping(parsed);
  assert.equal(mapping.hasHeader, true);
  assert.equal(mapping.html, false);
  const root = mkdtempSync(path.join(tmpdir(), 'supercard-readme-'));
  const store = new Store(root);
  try {
    importCards(store, new MediaStore(root), parsed, mapping, { deckName: 'README example' });
    const cards = store.load().cards;
    assert.equal(cards.length, 3);
    assert.equal(cards[0].back, 'Paris');
    assert.match(cards[1].front, /&quot;hello, world&quot;/);
    assert.equal(cards[2].back, '\\[2^3=8\\]');
  } finally {
    store.close();
  }
});
test('study shortcuts exclude controls, editing, dialogs, repeats and modifiers', () => {
  const dom = new JSDOM(
    '<div class="study-face" role="button"><span id="card"></span></div><input><textarea></textarea><select></select><div contenteditable="true"><span id="edit"></span></div><button></button><div role="combobox"></div>',
  );
  const event = (selector: string, key: string, extra = {}) =>
    ({
      target: dom.window.document.querySelector(selector),
      key,
      code: key === ' ' ? 'Space' : key,
      ...extra,
    }) as unknown as KeyboardEvent;
  for (const key of [' ', 'ArrowUp', 'ArrowDown'])
    assert.equal(studyShortcut(event('#card', key), false), 'flip');
  assert.equal(studyShortcut(event('#card', 'ArrowRight'), false), 'next');
  assert.equal(studyShortcut(event('#card', 'ArrowLeft'), false), 'previous');
  for (const selector of ['input', 'textarea', 'select', '#edit', 'button', '[role=combobox]'])
    for (const key of [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
      assert.equal(studyShortcut(event(selector, key), false), null);
  for (const extra of [
    { repeat: true },
    { isComposing: true },
    { ctrlKey: true },
    { defaultPrevented: true },
  ])
    assert.equal(studyShortcut(event('#card', 'ArrowUp', extra), false), null);
  assert.equal(studyShortcut(event('#card', 'ArrowDown'), true), null);
  dom.window.close();
});

test('supported image dimension readers reject oversized and malformed headers', async () => {
  const { imageDimensions } = await import('../electron/image-dimensions');
  const png = Buffer.alloc(33);
  png.write('IHDR', 12);
  png.writeUInt32BE(8000, 16);
  png.writeUInt32BE(5000, 20);
  assert.deepEqual(imageDimensions(png, 'png'), { width: 8000, height: 5000 });
  png.writeUInt32BE(5001, 20);
  assert.throws(() => imageDimensions(png, 'png'), /40 megapixels/);
  const gif = Buffer.alloc(13);
  gif.writeUInt16LE(2, 6);
  gif.writeUInt16LE(3, 8);
  assert.deepEqual(imageDimensions(gif, 'gif'), { width: 2, height: 3 });
  const jpeg = Buffer.from([255, 216, 255, 192, 0, 8, 8, 0, 3, 0, 2, 0]);
  assert.deepEqual(imageDimensions(jpeg, 'jpg'), { width: 2, height: 3 });
  assert.throws(() => imageDimensions(Buffer.from([255, 216, 255, 224, 0, 0]), 'jpg'));
  const webp = Buffer.alloc(30);
  webp.write('VP8X', 12);
  webp.writeUInt32LE(10, 16);
  webp.writeUIntLE(1, 24, 3);
  webp.writeUIntLE(2, 27, 3);
  assert.deepEqual(imageDimensions(webp, 'webp'), { width: 2, height: 3 });
});
