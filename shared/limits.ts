/** File limits use binary megabytes consistently: 200 × 1,024 × 1,024 bytes. */
export const FILE_LIMIT = 200 * 1024 * 1024;
export const FILE_LIMIT_LABEL = '200 MB (209,715,200 bytes)';
export const IMAGE_PIXELS = 40_000_000;
export const BACKGROUND_PIXELS = 120_000_000;
export const BACKGROUND_EDGE = 3840;
export function checkFileSize(size: number, limit = FILE_LIMIT) {
  if (!Number.isSafeInteger(size) || size < 0 || size > limit)
    throw new Error(
      `File exceeds the ${limit === FILE_LIMIT ? FILE_LIMIT_LABEL : `${limit} bytes`} limit.`,
    );
}
