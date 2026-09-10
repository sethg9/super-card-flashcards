import { dialog, type BrowserWindow } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Store } from './store';
import { textValue } from './store';
import type { MediaStore } from './media';
import { Transfers } from './transfer-runner';
import { checkFileSize } from '../shared/limits';
import { resizeBackground } from './background';
type Register = (channel: string, handler: (...args: any[]) => unknown) => void;
export function registerFileActions(
  handle: Register,
  store: Store,
  _media: MediaStore,
  getWindow: () => BrowserWindow,
) {
  const transfers = new Transfers(store.root);
  let preparingBackground = false;
  let mediaFolder: { token: string; path: string } | undefined;
  handle('transfer:cancel', () => transfers.cancel());
  handle('image:add', (bytes) => {
    if (!(bytes instanceof Uint8Array)) throw new Error('Invalid image bytes.');
    checkFileSize(bytes.byteLength);
    return transfers.run('image', { bytes });
  });
  const images = async (background: boolean) => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: background ? 'Choose a background image' : 'Insert images',
      properties: background ? ['openFile'] : ['openFile', 'multiSelections'],
      filters: [
        {
          name: background
            ? 'Background images (up to 200 MB)'
            : 'Images (up to 200 MB; 40 megapixels)',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
        },
      ],
    });
    if (result.canceled) return [];
    if (result.filePaths.length > 20) throw new Error('Insert at most 20 images at a time.');
    const names: string[] = [];
    for (const file of result.filePaths) {
      if (background) {
        const info = await transfers.run('inspectBackground', { file });
        const bytes = await resizeBackground(file, info);
        names.push(await transfers.run('image', { bytes }));
      } else names.push(await transfers.run('image', { file }));
    }
    return names;
  };
  handle('appearance:background', async () => {
    if (preparingBackground) throw new Error('A background is already being prepared.');
    preparingBackground = true;
    try {
      return (await images(true))[0] || null;
    } finally {
      preparingBackground = false;
    }
  });
  handle('image:pick', () => images(false));
  handle('csv:choose', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Import flashcards',
      properties: ['openFile'],
      filters: [{ name: 'CSV / TSV (up to 200 MB)', extensions: ['csv', 'tsv', 'txt'] }],
    });
    return result.canceled ? null : transfers.run('csv', { file: result.filePaths[0] }, true);
  });
  handle('csv:reparse', (token, delimiter) => {
    if (![',', '\t', ';', '|', ':', ' '].includes(delimiter)) throw new Error('Invalid separator.');
    return transfers.run('reparse', { token, delimiter }, true);
  });
  handle('media:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Select referenced images folder',
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    mediaFolder = { token: randomUUID(), path: result.filePaths[0] };
    return { token: mediaFolder.token, name: path.basename(mediaFolder.path) };
  });
  handle('csv:import', (options) => {
    if (!options || (options.mediaToken && options.mediaToken !== mediaFolder?.token))
      throw new Error('Import selection expired.');
    return transfers.run('import', {
      token: options.token,
      mapping: options.mapping,
      deckId: options.deckId,
      deckName: options.deckName,
      folder: options.mediaToken ? mediaFolder?.path : undefined,
    });
  });
  const save = async (deckId?: string) => {
    if (deckId) textValue(deckId, 'Deck ID', 100);
    const result = await dialog.showSaveDialog(getWindow(), {
      title: 'Export',
      defaultPath: deckId ? 'SuperCard-cards.zip' : 'SuperCard-backup.supercard',
      filters: [
        {
          name: deckId ? 'CSV with media' : 'SuperCard backup',
          extensions: [deckId ? 'zip' : 'supercard'],
        },
      ],
    });
    return result.canceled || !result.filePath
      ? null
      : transfers.run('export', { file: result.filePath, deckId });
  };
  handle('deck:export', (id) => save(id));
  handle('backup:export', () => save());
  handle('backup:preview', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Restore a SuperCard backup',
      properties: ['openFile'],
      filters: [{ name: 'SuperCard backup', extensions: ['supercard', 'zip'] }],
    });
    return result.canceled
      ? null
      : transfers.run('previewBackup', { file: result.filePaths[0] }, true);
  });
  handle('backup:restore', (token) => transfers.run('restore', { token }));
}
