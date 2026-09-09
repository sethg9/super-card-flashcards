import { dialog, nativeImage, type BrowserWindow } from 'electron';
import { readFileSync, statSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Store } from './store';
import { textValue } from './store';
import { MediaStore } from './media';
import { parseCSV, type Mapping } from '../shared/csv';
import { importCards, makeBackup, makeCSVArchive, readBackup, restoreBackup } from './transfers';
import { IMAGE_LIMIT } from '../shared/images';

type Register = (channel: string, handler: (...args: any[]) => unknown) => void;
export function registerFileActions(
  handle: Register,
  store: Store,
  media: MediaStore,
  getWindow: () => BrowserWindow,
) {
  // Opaque capabilities: renderer never supplies a filesystem path.
  let csv:
    | { token: string; name: string; source: string; parsed: ReturnType<typeof parseCSV> }
    | undefined;
  let mediaFolder: { token: string; path: string } | undefined;
  let backup: { token: string; data: ReturnType<typeof readBackup> } | undefined;
  const validateImage = (input: unknown) => {
    if (!(input instanceof Uint8Array) || input.byteLength > IMAGE_LIMIT)
      throw new Error('Choose an image smaller than 20 MB.');
    const image = nativeImage.createFromBuffer(Buffer.from(input));
    const size = image.getSize();
    if (image.isEmpty() || size.width * size.height > 40_000_000)
      throw new Error('Image could not be decoded or exceeds 40 megapixels.');
    return media.add(input);
  };
  const readLimited = (file: string, limit: number) => {
    if (statSync(file).size > limit)
      throw new Error(`File exceeds the ${Math.round(limit / 1024 / 1024)} MB limit.`);
    return readFileSync(file);
  };
  handle('image:add', validateImage);
  handle('appearance:background', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Choose a background image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    return result.canceled ? null : validateImage(readLimited(result.filePaths[0], IMAGE_LIMIT));
  });
  handle('image:pick', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Insert images',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    if (result.canceled) return [];
    if (result.filePaths.length > 20) throw new Error('Insert at most 20 images at a time.');
    return result.filePaths.map((file) => validateImage(readLimited(file, IMAGE_LIMIT)));
  });
  handle('csv:choose', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Import flashcards',
      properties: ['openFile'],
      filters: [{ name: 'CSV and tab-separated text', extensions: ['csv', 'tsv', 'txt'] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    const source = new TextDecoder('utf-8', { fatal: true }).decode(
      readLimited(file, 20 * 1024 * 1024),
    );
    csv = {
      token: randomUUID(),
      name: path.basename(file, path.extname(file)),
      source,
      parsed: parseCSV(source),
    };
    return { token: csv.token, name: csv.name, parsed: csv.parsed };
  });
  handle('csv:reparse', (token, delimiter) => {
    if (!csv || csv.token !== token || ![',', '\t', ';', '|', ':', ' '].includes(delimiter))
      throw new Error('Import expired or separator is invalid. Choose the file again.');
    csv.parsed = parseCSV(csv.source, delimiter);
    return { token: csv.token, name: csv.name, parsed: csv.parsed };
  });
  handle('media:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Select the folder containing referenced images',
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    mediaFolder = { token: randomUUID(), path: result.filePaths[0] };
    return { token: mediaFolder.token, name: path.basename(mediaFolder.path) };
  });
  handle(
    'csv:import',
    (options: {
      token: string;
      mapping: Mapping;
      deckId?: string;
      deckName: string;
      mediaToken?: string;
    }) => {
      if (!options || !csv || csv.token !== options.token)
        throw new Error('Import expired. Choose the file again.');
      if (options.mediaToken && options.mediaToken !== mediaFolder?.token)
        throw new Error('Media folder selection expired. Select it again.');
      const result = importCards(store, media, csv.parsed, options.mapping, {
        deckId: options.deckId,
        deckName: options.deckName,
        folder: options.mediaToken ? mediaFolder?.path : undefined,
      });
      csv = undefined;
      return result;
    },
  );
  const save = async (
    defaultPath: string,
    extension: string,
    build: () => { bytes: Uint8Array; warnings: string[] },
  ) => {
    const result = await dialog.showSaveDialog(getWindow(), {
      title: 'Export',
      defaultPath,
      filters: [
        {
          name: extension === 'zip' ? 'CSV with media' : 'SuperCard backup',
          extensions: [extension],
        },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    const output = build();
    const temp = `${result.filePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temp, output.bytes, { flag: 'wx' });
      renameSync(temp, result.filePath);
    } finally {
      if (existsSync(temp)) unlinkSync(temp);
    }
    return { message: `Saved ${path.basename(result.filePath)}.`, warnings: output.warnings };
  };
  handle('deck:export', (id) => {
    textValue(id, 'Deck ID', 100);
    const all = store.load(),
      deck = all.decks.find((d) => d.id === id);
    if (!deck) throw new Error('Deck no longer exists.');
    const name = deck.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    return save(`${name}.zip`, 'zip', () =>
      makeCSVArchive({ decks: [deck], cards: all.cards.filter((c) => c.deckId === id) }, media),
    );
  });
  handle('backup:export', () =>
    save(`SuperCard-backup-${new Date().toISOString().slice(0, 10)}.supercard`, 'supercard', () =>
      makeBackup(store.load(), media),
    ),
  );
  handle('backup:preview', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Restore a SuperCard backup',
      properties: ['openFile'],
      filters: [{ name: 'SuperCard backup', extensions: ['supercard', 'zip'] }],
    });
    if (result.canceled) return null;
    backup = {
      token: randomUUID(),
      data: readBackup(readLimited(result.filePaths[0], 256 * 1024 * 1024)),
    };
    return {
      token: backup.token,
      decks: backup.data.manifest.collection.decks.length,
      cards: backup.data.manifest.collection.cards.length,
      images: backup.data.images,
    };
  });
  handle('backup:restore', (token) => {
    if (!backup || backup.token !== token)
      throw new Error('Backup preview expired. Select it again.');
    const result = restoreBackup(store, media, backup.data);
    backup = undefined;
    return result;
  });
}
