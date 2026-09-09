// Generated examples only. Never read personal decks or CSVs in published tests.
import Papa from 'papaparse';
export const syntheticCards = Array.from({ length: 84 }, (_, i) => ({
  front: i === 9 ? 'Searchable synthetic question' : `Synthetic example ${i + 1}: \\(x_${i + 1}\\)`,
  back:
    i === 17
      ? 'A comma, a quote "and Unicode Ω"\nA second line'
      : `\\[x_${i + 1}^2 + 1\\]<br><b>Example answer</b>`,
  tags: 'synthetic fixture',
}));
export const syntheticCSV = Papa.unparse({
  fields: ['Front', 'Back', 'Tags'],
  data: syntheticCards.map((c) => [c.front, c.back, c.tags]),
});
