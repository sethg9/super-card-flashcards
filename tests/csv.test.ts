import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syntheticCSV, syntheticCards } from './fixtures/synthetic';
import { parseCSV, mapImport, defaultMapping, exportCSV } from '../shared/csv';
test('synthetic 84-card CSV preserves fields and round-trips', () => {
  const parsed = parseCSV(syntheticCSV);
  assert.deepEqual(parsed.columns, ['Front', 'Back', 'Tags']);
  const mapped = mapImport(parsed, defaultMapping(parsed));
  assert.equal(mapped.cards.length, 84);
  assert.equal(mapped.skipped, 0);
  assert.equal(mapped.cards[17].back, syntheticCards[17].back);
  const exported = parseCSV(exportCSV(mapped.cards as any));
  assert.deepEqual(mapImport(exported, defaultMapping(exported)).cards, mapped.cards);
});
test('CSV round-trips quotes, commas, multiline text, Unicode, math, and image references', () => {
  const cards = [
    {
      front: '"你好", café\n\\[\\frac{x}{2}\\]\n<img src="picture.png">',
      back: 'First\n# still in a quoted field\n"Second", third',
      tags: 'タグ calculus',
    },
  ];
  const parsed = parseCSV('\uFEFF' + exportCSV(cards));
  assert.deepEqual(mapImport(parsed, defaultMapping(parsed)).cards, cards);
});
test('TSV headers, explicit mapping, plain text, comments, tags and cloze reporting', () => {
  const parsed = parseCSV(
    '#separator:Tab\n#html:false\n#columns:GUID\tType\tAnswer\tQuestion\tTags\n#guid column:1\n#notetype column:2\n#tags column:5\n#tags:global\n#deck:Calculus\na\tBasic\t2 < 3\tWhat?\tlocal\nb\tCloze\tHidden\t{{c1::answer}}\tx\nc\tBasic\tBack\t\tx',
  );
  const mapping = { ...defaultMapping(parsed), front: 3, back: 2 };
  const result = mapImport(parsed, mapping);
  assert.deepEqual(result.cards, [{ front: 'What?', back: '2 &lt; 3', tags: 'global local' }]);
  assert.equal(result.skipped, 2);
  assert.ok(result.warnings.some((w) => /cloze row/.test(w)));
  assert.ok(result.warnings.some((w) => /GUID/.test(w)));
  assert.throws(() => mapImport(parsed, { ...mapping, back: 3 }));
});
test('malformed CSV, empty input, and missing mapped sides are handled explicitly', () => {
  assert.throws(() => parseCSV('"unclosed,field\nsecond,row'));
  assert.throws(() => parseCSV(''));
  const parsed = parseCSV('Front,Back\nQuestion,\nOther,Answer');
  assert.equal(mapImport(parsed, defaultMapping(parsed)).skipped, 1);
});
