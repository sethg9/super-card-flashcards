import { BrowserWindow, session } from 'electron';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { BACKGROUND_EDGE, checkFileSize } from '../shared/limits';

/** Decode away from both the main process and the study renderer. Only the resized PNG
 * crosses IPC; the original stays on disk and the disposable renderer releases its bitmap. */
export async function resizeBackground(
  file: string,
  info: { ext: string; width: number; height: number },
) {
  const decoderSession = session.fromPartition('background-decoder', { cache: false });
  decoderSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  decoderSession.setPermissionCheckHandler(() => false);
  const origin = 'https://background.supercard.invalid';
  decoderSession.protocol.handle('https', async (request) => {
    if (request.url === origin + '/')
      return new Response('<!doctype html><title>Background preparation</title>', {
        headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy': "default-src 'none'; connect-src 'self'; img-src 'self' blob:",
        },
      });
    if (request.url !== origin + '/image') return new Response('', { status: 403 });
    checkFileSize((await stat(file)).size);
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        'Content-Type': `image/${info.ext === 'jpg' ? 'jpeg' : info.ext}`,
        'Cache-Control': 'no-store',
      },
    });
  });
  decoderSession.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !details.url.startsWith(origin + '/') }),
  );
  const decoder = new BrowserWindow({
    show: false,
    webPreferences: {
      session: decoderSession,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  decoder.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  decoder.webContents.on('will-navigate', (event) => event.preventDefault());
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const scale = Math.min(1, BACKGROUND_EDGE / Math.max(info.width, info.height));
  try {
    return await Promise.race([
      (async () => {
        await decoder.loadURL(origin + '/');
        const result: string = await decoder.webContents.executeJavaScript(`(async () => {
          const response = await fetch('/image');
          if (!response.ok) throw new Error('Image file is unavailable');
          const bitmap = await createImageBitmap(await response.blob(), {
            resizeWidth: ${Math.max(1, Math.round(info.width * scale))},
            resizeQuality: 'high'
          });
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, ${BACKGROUND_EDGE} / Math.max(bitmap.width, bitmap.height));
          canvas.width = Math.max(1, Math.round(bitmap.width * scale));
          canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
          return canvas.toDataURL('image/png');
        })()`);
        return Buffer.from(result.slice('data:image/png;base64,'.length), 'base64');
      })(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(new Error('Background preparation timed out. Try exporting the photo as JPEG.')),
          45000,
        );
      }),
    ]);
  } catch (error) {
    throw new Error(
      `Background could not be decoded. Choose a valid PNG, JPEG, GIF or WebP. HEIC/HEIF must be exported as JPEG. ${error instanceof Error ? error.message : ''}`,
    );
  } finally {
    clearTimeout(timeout);
    decoder.destroy();
    decoderSession.protocol.unhandle('https');
    decoderSession.webRequest.onBeforeRequest(null);
  }
}
