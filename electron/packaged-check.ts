import { mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Transfers } from './transfer-runner';
import { Store } from './store';
/** Explicit packaged test mode; all generated data stays in the selected test profile. */
export async function checkPackagedTransfers(profile: string) {
  const root = await mkdtemp(path.join(profile, 'transfer-check-'));
  const transfers = new Transfers(root);
  try {
    const file = path.join(root, 'synthetic.csv');
    await writeFile(file, 'Front,Back,Tags\n"Synthetic question","\\[2^3=8\\]","test"');
    const preview = await transfers.run('csv', { file });
    const report = await transfers.run('import', {
      token: preview.token,
      mapping: { front: 0, back: 1, tags: 2, hasHeader: true, html: true },
      deckName: 'Packaged transfer check',
    });
    await transfers.run('export', { deckId: report.deckId, file: path.join(root, 'cards.zip') });
    const backup = path.join(root, 'library.supercard');
    await transfers.run('export', { file: backup });
    const restore = await transfers.run('previewBackup', { file: backup });
    await transfers.run('restore', { token: restore.token });
    const store = new Store(root);
    try {
      const collection = store.load();
      if (
        collection.decks.length !== 2 ||
        collection.cards.length !== 2 ||
        collection.cards.some((c) => c.back !== '\\[2^3=8\\]')
      )
        throw new Error('Packaged transfer round trip failed');
    } finally {
      store.close();
    }
    return { csvImport: true, csvExport: true, backupExport: true, backupRestore: true };
  } finally {
    await transfers.close();
  }
}
