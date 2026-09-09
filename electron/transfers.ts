import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { imageReferences, MANAGED_IMAGE, IMAGE_LIMIT } from '../shared/images';
import { exportCSV, mapImport, type Mapping, type ParsedImport } from '../shared/csv';
import type { Collection, TransferReport } from '../shared/types';
import { Store, textValue } from './store';
import { MediaStore, imageExtension } from './media';
import { createHash } from 'node:crypto';

const ARCHIVE_LIMIT = 256 * 1024 * 1024;
interface Manifest {
  format: 'supercard';
  version: 1;
  collection: Collection;
}
export interface Backup {
  manifest: Manifest;
  files: Record<string, Uint8Array>;
  images: number;
}

export function importCards(
  store: Store,
  media: MediaStore,
  parsed: ParsedImport,
  mapping: Mapping,
  destination: { deckId?: string; deckName: string; folder?: string },
): TransferReport {
  const result = mapImport(parsed, mapping);
  if (!result.cards.length)
    throw new Error('No basic cards with both sides are available to import.');
  if (destination.deckId && !store.load().decks.some((d) => d.id === destination.deckId))
    throw new Error('Destination deck no longer exists.');
  const missing = new Set<string>();
  const prepared = result.cards.map((card) => ({
    ...card,
    front: media.resolve(card.front, destination.folder, missing),
    back: media.resolve(card.back, destination.folder, missing),
  }));
  return store.transaction(() => {
    const deckId = destination.deckId || store.createDeck(destination.deckName).id;
    for (const card of prepared) store.saveCard({ ...card, deckId });
    return {
      deckId,
      message: `Imported ${prepared.length} cards${result.skipped ? `; skipped ${result.skipped} rows` : ''}.`,
      warnings: [
        ...result.warnings,
        ...[...missing].map(
          (name) => `Missing or unsupported image: ${name || '(empty reference)'}`,
        ),
      ],
    };
  });
}
function collectMedia(collection: Collection, media: MediaStore) {
  const files: Record<string, Uint8Array> = Object.create(null);
  const missing: string[] = [];
  const refs = new Set(
    collection.cards.flatMap((c) => [...imageReferences(c.front), ...imageReferences(c.back)]),
  );
  let size = 0;
  for (const name of refs) {
    try {
      const bytes = media.read(name);
      size += bytes.length;
      if (size > ARCHIVE_LIMIT)
        throw new Error('Archive exceeds 256 MB. Export smaller decks individually.');
      files[`media/${name}`] = bytes;
    } catch (error) {
      if (size > ARCHIVE_LIMIT) throw error;
      missing.push(`Missing image: ${name}`);
    }
  }
  return { files, missing };
}
export function makeCSVArchive(collection: Collection, media: MediaStore) {
  const { files, missing } = collectMedia(collection, media);
  files['cards.csv'] = strToU8(exportCSV(collection.cards));
  files['READ-ME.txt'] = strToU8(
    'Import cards.csv into Anki with HTML enabled. Copy files from media/ into Anki collection.media first. In SuperCard, select media/ when importing the CSV. Math source and HTML image references are preserved.\n' +
      missing.join('\n'),
  );
  return { bytes: zipSync(files, { level: 6 }), warnings: missing };
}
export function makeBackup(collection: Collection, media: MediaStore) {
  const { files, missing } = collectMedia(collection, media);
  files['manifest.json'] = strToU8(
    JSON.stringify({ format: 'supercard', version: 1, collection } satisfies Manifest),
  );
  return { bytes: zipSync(files, { level: 6 }), warnings: missing };
}
export function readBackup(bytes: Uint8Array): Backup {
  if (bytes.length > ARCHIVE_LIMIT) throw new Error('Backup exceeds the 256 MB limit.');
  let total = 0,
    entries = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      total += entry.originalSize;
      entries++;
      if (entries > 30_000 || total > ARCHIVE_LIMIT || !Number.isFinite(total))
        throw new Error('Backup expands beyond the supported size.');
      if (
        entry.name !== 'manifest.json' &&
        !/^media\/[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(entry.name)
      )
        throw new Error('Backup contains an unexpected or unsafe file path.');
      if (entry.originalSize > (entry.name === 'manifest.json' ? 40_000_000 : IMAGE_LIMIT))
        throw new Error('A backup entry is too large.');
      return true;
    },
  });
  if (!files['manifest.json']) throw new Error('This is not a SuperCard backup.');
  const manifest = JSON.parse(strFromU8(files['manifest.json'])) as Manifest;
  if (manifest.format !== 'supercard' || manifest.version !== 1)
    throw new Error('Unsupported backup format or version.');
  const collection = manifest.collection;
  if (
    !collection ||
    !Array.isArray(collection.decks) ||
    !Array.isArray(collection.cards) ||
    collection.decks.length > 10_000 ||
    collection.cards.length > 100_000
  )
    throw new Error('Invalid backup collection.');
  const deckIds = new Set<string>(),
    cardIds = new Set<string>();
  for (const deck of collection.decks) {
    if (
      !deck ||
      !textValue(deck.name, 'Deck name', 100).trim() ||
      !textValue(deck.id, 'Deck ID', 100) ||
      deckIds.has(deck.id)
    )
      throw new Error('Invalid or duplicate deck in backup.');
    textValue(deck.createdAt, 'Created timestamp', 100);
    deckIds.add(deck.id);
  }
  for (const card of collection.cards) {
    if (
      !card ||
      !textValue(card.id, 'Card ID', 100) ||
      cardIds.has(card.id) ||
      !deckIds.has(card.deckId) ||
      !textValue(card.front, 'Front').trim() ||
      !textValue(card.back, 'Back').trim()
    )
      throw new Error('Invalid card in backup.');
    textValue(card.tags, 'Tags', 10_000);
    textValue(card.createdAt, 'Created timestamp', 100);
    textValue(card.updatedAt, 'Updated timestamp', 100);
    cardIds.add(card.id);
  }
  let images = 0;
  for (const [name, value] of Object.entries(files)) {
    if (name === 'manifest.json') continue;
    const ext = imageExtension(value),
      hash = createHash('sha256').update(value).digest('hex');
    if (name !== `media/${hash}.${ext}`)
      throw new Error('A backup image failed its integrity check.');
    images++;
  }
  return { manifest, files, images };
}
export function restoreBackup(store: Store, media: MediaStore, backup: Backup): TransferReport {
  const warnings: string[] = [];
  for (const [name, bytes] of Object.entries(backup.files))
    if (name !== 'manifest.json') media.add(bytes);
  const result = store.transaction(() => {
    const ids = new Map<string, string>();
    const names = new Set(store.load().decks.map((d) => d.name));
    for (const deck of backup.manifest.collection.decks) {
      let name = deck.name,
        n = 1;
      while (names.has(name)) name = `${deck.name.slice(0, 78)} (restored ${n++})`;
      names.add(name);
      ids.set(deck.id, store.createDeck(name).id);
    }
    for (const card of backup.manifest.collection.cards) {
      store.saveCard({
        front: card.front,
        back: card.back,
        tags: card.tags,
        deckId: ids.get(card.deckId)!,
      });
      for (const ref of new Set([...imageReferences(card.front), ...imageReferences(card.back)])) {
        if (!MANAGED_IMAGE.test(ref) || !backup.files[`media/${ref}`])
          warnings.push(`Missing image in backup: ${ref}`);
      }
    }
    return {
      deckId: ids.values().next().value,
      message: `Restored ${ids.size} decks and ${backup.manifest.collection.cards.length} cards. Existing decks were kept.`,
      warnings: [...new Set(warnings)],
    };
  });
  return result;
}
