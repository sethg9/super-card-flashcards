import { app, BrowserWindow, ipcMain, protocol, session, Menu, dialog } from 'electron';
import path from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { MANAGED_IMAGE } from '../shared/images';
import { checkFileSize } from '../shared/limits';
import { Store } from './store';
import { MediaStore } from './media';
import { registerFileActions } from './file-actions';
import { checkPackagedTransfers } from './packaged-check';

app.setName('SuperCard');
app.setPath('userData', path.join(app.getPath('appData'), 'SuperCard'));
// Explicit test profiles also isolate packaged smoke tests from the real library.
if (process.env.SUPERCARD_TEST_DATA && path.isAbsolute(process.env.SUPERCARD_TEST_DATA))
  app.setPath('userData', process.env.SUPERCARD_TEST_DATA);
protocol.registerSchemesAsPrivileged([
  { scheme: 'supercard', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'supercard-media', privileges: { standard: true, secure: true } },
]);
const devURL =
  !app.isPackaged && process.env.SUPERCARD_DEV_URL === 'http://127.0.0.1:5173'
    ? process.env.SUPERCARD_DEV_URL
    : undefined;
let store: Store;
let window: BrowserWindow;
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on('second-instance', () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});

export function handle(channel: string, handler: (...args: any[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    const frame = event.senderFrame;
    const url = frame && new URL(frame.url);
    if (
      !frame ||
      !url ||
      event.sender !== window.webContents ||
      frame !== window.webContents.mainFrame ||
      !(devURL ? url.origin === devURL : url.protocol === 'supercard:' && url.hostname === 'app')
    )
      throw new Error('Untrusted request.');
    return handler(...args);
  });
}

app
  .whenReady()
  .then(() => {
    if (!hasLock) return;
    store = new Store(app.getPath('userData'));
    const media = new MediaStore(app.getPath('userData'));
    registerFileActions(handle, store, media, () => window);
    if (
      app.isPackaged &&
      process.env.SUPERCARD_SMOKE_TRANSFERS === '1' &&
      process.env.SUPERCARD_TEST_DATA &&
      path.isAbsolute(process.env.SUPERCARD_TEST_DATA)
    ) {
      void checkPackagedTransfers(app.getPath('userData')).then(
        (result) =>
          writeFile(
            path.join(app.getPath('userData'), 'transfer-result.json'),
            JSON.stringify(result),
          ),
        (error) =>
          writeFile(
            path.join(app.getPath('userData'), 'transfer-result.json'),
            JSON.stringify({ error: String(error) }),
          ),
      );
    }
    protocol.handle('supercard-media', async (request) => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== 'local') throw new Error('Invalid media origin');
        const name = decodeURIComponent(url.pathname.slice(1));
        const mime: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
        };
        if (!MANAGED_IMAGE.test(name)) throw new Error('Invalid managed image');
        const file = path.join(media.dir, name);
        checkFileSize((await stat(file)).size);
        return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
          headers: {
            'Content-Type': mime[name.split('.').pop()!] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'max-age=31536000, immutable',
          },
        });
      } catch {
        return new Response('Image unavailable', { status: 404 });
      }
    });
    const dist = path.join(__dirname, '../dist');
    protocol.handle('supercard', async (request) => {
      const url = new URL(request.url);
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(dist, '.' + relative);
      if (url.hostname !== 'app' || !file.startsWith(dist + path.sep))
        return new Response('Forbidden', { status: 403 });
      const mime: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.svg': 'image/svg+xml',
      };
      try {
        return new Response(await readFile(file), {
          headers: {
            'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url);
      const allowed =
        url.protocol === 'supercard:' ||
        url.protocol === 'supercard-media:' ||
        (devURL && (url.origin === devURL || url.origin === 'ws://127.0.0.1:5173'));
      callback({ cancel: !allowed });
    });
    handle('collection:load', () => store.load());
    handle('appearance:load', () => store.loadAppearance());
    handle('appearance:save', (value) => store.saveAppearance(value));
    handle('deck:create', (name) => store.createDeck(name));
    handle('deck:rename', (id, name) => store.renameDeck(id, name));
    handle('deck:delete', (id) => store.deleteDeck(id));
    handle('card:save', (card) => store.saveCard(card));
    handle('card:delete', (id) => store.deleteCard(id));
    handle('app:dataPath', () => app.getPath('userData'));
    let closeReady = false,
      allowClose = false;
    handle('app:closeReady', () => {
      closeReady = true;
    });
    handle('app:finishClose', () => {
      setImmediate(() => {
        allowClose = true;
        window.close();
      });
    });
    Menu.setApplicationMenu(null);
    window = new BrowserWindow({
      width: 1360,
      height: 900,
      minWidth: 760,
      minHeight: 600,
      backgroundColor:
        store.loadAppearance()?.theme === 'oled'
          ? '#000000'
          : store.loadAppearance()?.theme === 'dark'
            ? '#151722'
            : '#f8f9fc',
      title: 'SuperCard',
      icon: path.join(__dirname, '../assets/icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
      },
    });
    window.on('close', (event) => {
      if (closeReady && !allowClose) {
        event.preventDefault();
        window.webContents.send('app:closeRequested');
      }
    });
    window.webContents.on('render-process-gone', () => {
      closeReady = false;
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.loadURL(devURL ?? 'supercard://app/index.html');
  })
  .catch((error) => {
    console.error(error);
    dialog.showErrorBox(
      'SuperCard could not start',
      `Your files have been kept. ${error instanceof Error ? error.message : String(error)}`,
    );
    app.quit();
  });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => store?.close());
