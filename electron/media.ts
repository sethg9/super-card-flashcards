import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { IMAGE_LIMIT, MANAGED_IMAGE, mapImageReferences } from '../shared/images';

export function imageExtension(bytes: Uint8Array): string {
  const b = Buffer.from(bytes);
  if (b.length < 12 || b.length > IMAGE_LIMIT)
    throw new Error('Choose an image smaller than 20 MB.');
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'jpg';
  if (/^GIF8[79]a$/.test(b.toString('ascii', 0, 6))) return 'gif';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  throw new Error(
    'Supported images: PNG, JPEG, GIF, and WebP. SVG and other active formats are not supported.',
  );
}
export class MediaStore {
  dir: string;
  constructor(
    root: string,
    private validate?: (bytes: Uint8Array) => void,
  ) {
    this.dir = path.join(root, 'media');
    mkdirSync(this.dir, { recursive: true });
  }
  add(bytes: Uint8Array): string {
    const ext = imageExtension(bytes);
    this.validate?.(bytes);
    const name = `${createHash('sha256').update(bytes).digest('hex')}.${ext}`;
    const file = path.join(this.dir, name);
    if (!existsSync(file)) writeFileSync(file, bytes, { flag: 'wx' });
    return name;
  }
  read(name: string): Buffer {
    if (!MANAGED_IMAGE.test(name)) throw new Error('Invalid managed image name.');
    return readFileSync(path.join(this.dir, name));
  }
  resolve(source: string, folder: string | undefined, missing: Set<string>): string {
    return mapImageReferences(source, (ref) => {
      if (MANAGED_IMAGE.test(ref) && existsSync(path.join(this.dir, ref))) return ref;
      // Anki media is flat. Reject paths, URL schemes, NTFS streams, and directory traversal.
      if (
        !folder ||
        !ref ||
        /[<>:"/\\|?*\x00-\x1f]/.test(ref) ||
        ref === '.' ||
        ref === '..' ||
        /[. ]$/.test(ref)
      ) {
        missing.add(ref);
        return ref;
      }
      try {
        const file = path.join(folder, ref);
        const real = realpathSync(file),
          parent = realpathSync(folder);
        if (
          path.dirname(real).toLowerCase() !== parent.toLowerCase() ||
          statSync(real).size > IMAGE_LIMIT
        )
          throw new Error('Invalid image');
        return this.add(readFileSync(real));
      } catch {
        missing.add(ref);
        return ref;
      }
    });
  }
}
