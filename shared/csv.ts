import Papa from 'papaparse';
import type { CardInput } from './types';

export interface ParsedImport {
  rows: string[][];
  columns: string[];
  delimiter: string;
  headers: Record<string, string>;
  hasHeader: boolean;
  warnings: string[];
}
export interface Mapping {
  front: number;
  back: number;
  tags: number;
  hasHeader: boolean;
  html: boolean;
}
const separators: Record<string, string> = {
  comma: ',',
  tab: '\t',
  semicolon: ';',
  space: ' ',
  pipe: '|',
  colon: ':',
};
export const escapeHTML = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function parseCSV(source: string, delimiter?: string): ParsedImport {
  if (source.length > 20_000_000)
    throw new Error('CSV is too large. Split it into files below 20 MB.');
  source = source.replace(/^\uFEFF/, '');
  const headers: Record<string, string> = {};
  // Only consume leading comment lines, never lines inside a quoted field.
  while (source.startsWith('#')) {
    const end = source.indexOf('\n');
    const line = (end < 0 ? source : source.slice(0, end)).replace(/\r$/, '');
    const match = line.match(/^#([^:]+):(.*)$/);
    if (match) headers[match[1].trim().toLowerCase()] = match[2].trim();
    source = end < 0 ? '' : source.slice(end + 1);
  }
  const configured = delimiter || separators[headers.separator?.toLowerCase()] || headers.separator;
  const parsed = Papa.parse<string[]>(source, {
    delimiter: configured || '',
    skipEmptyLines: 'greedy',
    comments: '#',
    delimitersToGuess: [',', '\t', ';', '|'],
    quoteChar: '"',
  });
  const fatal = parsed.errors.filter((e) => e.code !== 'UndetectableDelimiter');
  if (fatal.length)
    throw new Error(
      `CSV could not be read: ${fatal
        .slice(0, 3)
        .map((e) => `record ${(e.row ?? 0) + 1}: ${e.message}`)
        .join('; ')}`,
    );
  const rows = parsed.data;
  if (!rows.length) throw new Error('This file contains no cards.');
  if (rows.length > 20_001) throw new Error('Import at most 20,000 cards at a time.');
  const width = Math.max(...rows.map((r) => r.length));
  if (width < 2 || width > 100)
    throw new Error('Expected 2–100 columns. Check the file separator.');
  const actualDelimiter = parsed.meta.delimiter || configured || ',';
  const declared = headers.columns
    ? Papa.parse<string[]>(headers.columns, { delimiter: actualDelimiter }).data[0]
    : null;
  const first = rows[0].map((s) => s.trim().toLowerCase());
  const hasHeader =
    !declared &&
    ((first.includes('front') && first.includes('back')) ||
      (first.includes('question') && first.includes('answer')));
  const columns = Array.from(
    { length: width },
    (_, i) => declared?.[i] || (hasHeader ? rows[0][i] : '') || `Column ${i + 1}`,
  );
  const warnings: string[] = [];
  if (rows.some((r) => r.length !== width))
    warnings.push(
      'Some rows have different column counts. Rows missing a mapped side will be skipped.',
    );
  const known = [
    'separator',
    'html',
    'columns',
    'tags',
    'tags column',
    'deck',
    'deck column',
    'notetype',
    'notetype column',
    'guid column',
  ];
  Object.keys(headers)
    .filter((k) => !known.includes(k))
    .forEach((k) => warnings.push(`Unsupported header #${k} is ignored.`));
  if (headers['guid column'])
    warnings.push(
      'Anki GUIDs are ignored. Import adds new cards; it does not update matching notes.',
    );
  if (headers['deck column'])
    warnings.push('Deck-column values are ignored. All cards go into the destination you select.');
  if (headers.notetype || headers['notetype column'])
    warnings.push(
      'Only basic front/back cards are supported. Custom templates and reverse-card generation are ignored; cloze rows are skipped.',
    );
  return { rows, columns, delimiter: actualDelimiter, headers, hasHeader, warnings };
}
export function defaultMapping(parsed: ParsedImport): Mapping {
  const names = parsed.columns.map((c) => c.toLowerCase());
  const special = ['tags column', 'notetype column', 'deck column', 'guid column']
    .map((k) => Number(parsed.headers[k]) - 1)
    .filter((n) => n >= 0);
  const regular = names.map((_, i) => i).filter((i) => !special.includes(i));
  const find = (a: string, b: string, fallback: number) =>
    names.findIndex((n) => n === a || n === b) < 0
      ? fallback
      : names.findIndex((n) => n === a || n === b);
  return {
    front: find('front', 'question', regular[0] ?? 0),
    back: find('back', 'answer', regular[1] ?? 1),
    tags: parsed.headers['tags column']
      ? Number(parsed.headers['tags column']) - 1
      : names.indexOf('tags'),
    hasHeader: parsed.hasHeader,
    html: parsed.headers.html?.toLowerCase() !== 'false',
  };
}
export function mapImport(parsed: ParsedImport, mapping: Mapping) {
  const width = parsed.columns.length;
  if (
    !mapping ||
    ![mapping.front, mapping.back].every((n) => Number.isInteger(n) && n >= 0 && n < width) ||
    mapping.front === mapping.back ||
    !Number.isInteger(mapping.tags) ||
    mapping.tags < -1 ||
    mapping.tags >= width ||
    typeof mapping.html !== 'boolean' ||
    typeof mapping.hasHeader !== 'boolean'
  )
    throw new Error('Choose distinct front and back columns.');
  const cards: Omit<CardInput, 'deckId'>[] = [];
  const warnings = [...parsed.warnings];
  let cloze = 0,
    empty = 0,
    unsupported = 0;
  for (const row of parsed.rows.slice(mapping.hasHeader ? 1 : 0)) {
    let front = row[mapping.front] || '',
      back = row[mapping.back] || '';
    const noteType = parsed.headers['notetype column']
      ? row[Number(parsed.headers['notetype column']) - 1]
      : parsed.headers.notetype;
    if (/cloze/i.test(noteType || '') || /\{\{c\d+::/i.test(front + back)) {
      cloze++;
      continue;
    }
    if (!front.trim() || !back.trim()) {
      empty++;
      continue;
    }
    if (front.length > 200_000 || back.length > 200_000)
      throw new Error('A mapped field exceeds the 200,000 character limit.');
    if (/\[sound:|<(?:audio|video|iframe|script|style)\b|\{\{[^}]+\}\}/i.test(front + back))
      unsupported++;
    if (!mapping.html) {
      front = escapeHTML(front);
      back = escapeHTML(back);
    }
    cards.push({
      front,
      back,
      tags: [parsed.headers.tags, mapping.tags >= 0 ? row[mapping.tags] : '']
        .filter(Boolean)
        .join(' '),
    });
  }
  if (cloze)
    warnings.push(
      `${cloze} cloze ${cloze === 1 ? 'row' : 'rows'} will be skipped. Cloze templates are not supported.`,
    );
  if (empty)
    warnings.push(
      `${empty} ${empty === 1 ? 'row has' : 'rows have'} an empty front or back and will be skipped.`,
    );
  if (unsupported)
    warnings.push(
      `${unsupported} rows contain unsupported media, templates, or active HTML. Source is retained, but only safe basic formatting and images are displayed.`,
    );
  return { cards, warnings, skipped: cloze + empty };
}
export function exportCSV(cards: { front: string; back: string; tags: string }[]): string {
  return (
    '#separator:Comma\r\n#html:true\r\n#columns:Front,Back,Tags\r\n#tags column:3\r\n' +
    Papa.unparse(
      cards.map((c) => [c.front, c.back, c.tags]),
      { newline: '\r\n', quotes: true },
    )
  );
}
