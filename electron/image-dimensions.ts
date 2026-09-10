import { IMAGE_PIXELS } from '../shared/limits';
/** Read dimensions without allocating a decoded bitmap. All marker walks are bounded. */
export function imageDimensions(bytes: Uint8Array, ext: string, pixelLimit = IMAGE_PIXELS) {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0;
  if (ext === 'png' && b.length >= 33 && b.toString('ascii', 12, 16) === 'IHDR') {
    width = b.readUInt32BE(16);
    height = b.readUInt32BE(20);
  } else if (ext === 'gif' && b.length >= 13) {
    width = b.readUInt16LE(6);
    height = b.readUInt16LE(8);
  } else if (ext === 'jpg') {
    let offset = 2;
    while (offset + 4 <= b.length) {
      if (b[offset++] !== 0xff) break;
      while (offset < b.length && b[offset] === 0xff) offset++;
      const marker = b[offset++];
      if (marker === 0xda || marker === 0xd9 || offset + 2 > b.length) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      const length = b.readUInt16BE(offset);
      if (length < 2 || offset + length > b.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        ) &&
        length >= 8
      ) {
        height = b.readUInt16BE(offset + 3);
        width = b.readUInt16BE(offset + 5);
        break;
      }
      offset += length;
    }
  } else if (ext === 'webp') {
    let offset = 12;
    while (offset + 8 <= b.length) {
      const kind = b.toString('ascii', offset, offset + 4),
        length = b.readUInt32LE(offset + 4);
      const start = offset + 8;
      if (start + length > b.length) break;
      if (kind === 'VP8X' && length >= 10) {
        width = b.readUIntLE(start + 4, 3) + 1;
        height = b.readUIntLE(start + 7, 3) + 1;
        break;
      }
      if (kind === 'VP8L' && length >= 5 && b[start] === 0x2f) {
        const bits = b.readUInt32LE(start + 1);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
        break;
      }
      if (
        kind === 'VP8 ' &&
        length >= 10 &&
        b[start + 3] === 0x9d &&
        b[start + 4] === 1 &&
        b[start + 5] === 0x2a
      ) {
        width = b.readUInt16LE(start + 6) & 0x3fff;
        height = b.readUInt16LE(start + 8) & 0x3fff;
        break;
      }
      offset = start + length + (length % 2);
    }
  }
  if (!width || !height)
    throw new Error('Image dimensions could not be read. The file may be malformed.');
  if (width * height > pixelLimit || width > 32768 || height > 32768)
    throw new Error(
      `Image exceeds the decoding safety limit (${pixelLimit / 1_000_000} megapixels; 32768 pixels per side).`,
    );
  return { width, height };
}
