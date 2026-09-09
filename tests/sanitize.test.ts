import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
test('untrusted HTML loses active content and external URLs while safe formatting and TeX survive', async () => {
  const dom = new JSDOM('');
  (globalThis as any).window = dom.window;
  const { sanitizeCard } = await import('../src/sanitize');
  const name = `${'a'.repeat(64)}.png`;
  const dirty = `<b onclick="bad()">bold</b><script>bad()</script><style>body{display:none}</style><svg onload="bad()"></svg><iframe src="file:///secret"></iframe><img src="https://example.com/x" onerror="bad()"><img src="${name}"><a href="javascript:bad()">link</a> \\(x<y \\land y>0\\) \\[\\begin{matrix}a&b\\end{matrix}\\]`;
  const output = sanitizeCard(dirty);
  const document = new JSDOM(output).window.document;
  assert.equal(
    document.querySelectorAll('script, style, iframe, svg, a, [onclick], [onerror]').length,
    0,
  );
  assert.equal(document.querySelector('b')?.textContent, 'bold');
  assert.equal(document.querySelectorAll('img[src]').length, 1);
  assert.equal(
    document.querySelector('img[src]')?.getAttribute('src'),
    `supercard-media://local/${name}`,
  );
  assert.ok(document.body.textContent?.includes('\\(x<y \\land y>0\\)'));
  assert.ok(document.body.textContent?.includes('a&b'));
});
