export const MANAGED_IMAGE = /^[a-f0-9]{64}\.(png|jpg|gif|webp)$/;
export { FILE_LIMIT as IMAGE_LIMIT } from './limits';
export function decodeReference(s: string) {
  return s.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, (entity) => {
    const named: Record<string, string> = {
      '&amp;': '&',
      '&quot;': '"',
      '&apos;': "'",
      '&lt;': '<',
      '&gt;': '>',
    };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const value =
      entity[2].toLowerCase() === 'x'
        ? parseInt(entity.slice(3, -1), 16)
        : parseInt(entity.slice(2, -1), 10);
    return value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
  });
}
export function mapImageReferences(source: string, transform: (name: string) => string): string {
  return source.replace(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, (tag) =>
    tag.replace(
      /(\s+src\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
      (_all, prefix, double, single, bare) => {
        const old = double ?? single ?? bare;
        const next = transform(decodeReference(old));
        return `${prefix}"${next.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
      },
    ),
  );
}
export function imageReferences(source: string): string[] {
  const refs = new Set<string>();
  mapImageReferences(source, (name) => {
    refs.add(name);
    return name;
  });
  return [...refs];
}
