import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync, statSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from './store';
import { MediaStore } from './media';
import { parseCSV } from '../shared/csv';
import { FILE_LIMIT, checkFileSize } from '../shared/limits';
import { importCards, makeBackup, makeCSVArchive, readBackup, restoreBackup } from './transfers';
const store = new Store(workerData.root);
const media = new MediaStore(workerData.root);
let csv:
  { token: string; name: string; source: string; parsed: ReturnType<typeof parseCSV> } | undefined;
let backup: { token: string; data: ReturnType<typeof readBackup> } | undefined;
function read(file: string, limit = FILE_LIMIT) {
  checkFileSize(statSync(file).size, limit);
  const bytes = readFileSync(file);
  checkFileSize(bytes.byteLength, limit);
  return bytes;
}
function preview() {
  if (!csv) throw new Error('Choose a CSV again.');
  return {
    token: csv.token,
    name: csv.name,
    totalRows: csv.parsed.rows.length,
    parsed: {
      ...csv.parsed,
      rows: csv.parsed.rows.slice(0, 11).map((row) => row.map((field) => field.slice(0, 4000))),
    },
  };
}
function run(op: string, args: any): any {
  if (op === 'image') return media.add(args.bytes || read(args.file));
  if (op === 'csv') {
    const source = new TextDecoder('utf-8', { fatal: true }).decode(read(args.file));
    csv = {
      token: randomUUID(),
      name: path.basename(args.file, path.extname(args.file)),
      source,
      parsed: parseCSV(source),
    };
    return preview();
  }
  if (op === 'reparse') {
    if (!csv || args.token !== csv.token) throw new Error('Import expired. Choose the file again.');
    csv.parsed = parseCSV(csv.source, args.delimiter);
    return preview();
  }
  if (op === 'import') {
    if (!csv || args.token !== csv.token) throw new Error('Import expired. Choose the file again.');
    const result = importCards(store, media, csv.parsed, args.mapping, args);
    csv = undefined;
    return result;
  }
  if (op === 'previewBackup') {
    backup = { token: randomUUID(), data: readBackup(read(args.file, 256 * 1024 * 1024)) };
    return {
      token: backup.token,
      decks: backup.data.manifest.collection.decks.length,
      cards: backup.data.manifest.collection.cards.length,
      images: backup.data.images,
    };
  }
  if (op === 'restore') {
    if (!backup || args.token !== backup.token)
      throw new Error('Backup preview expired. Choose it again.');
    const result = restoreBackup(store, media, backup.data);
    backup = undefined;
    return result;
  }
  if (op === 'export') {
    const all = store.load();
    const deck = args.deckId ? all.decks.find((d) => d.id === args.deckId) : undefined;
    if (args.deckId && !deck) throw new Error('Deck no longer exists.');
    const output = deck
      ? makeCSVArchive(
          { decks: [deck], cards: all.cards.filter((c) => c.deckId === deck.id) },
          media,
        )
      : makeBackup(all, media);
    const temp = `${args.file}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temp, output.bytes, { flag: 'wx' });
      renameSync(temp, args.file);
    } finally {
      if (existsSync(temp)) unlinkSync(temp);
    }
    return { message: `Saved ${path.basename(args.file)}.`, warnings: output.warnings };
  }
  throw new Error('Unknown transfer operation.');
}
parentPort!.on('message', ({ op, args }) => {
  try {
    parentPort!.postMessage({ result: run(op, args) });
  } catch (error) {
    parentPort!.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
});
