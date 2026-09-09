import DOMPurify from 'dompurify';
import { MANAGED_IMAGE } from '../shared/images';
const allowed = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'br',
  'p',
  'div',
  'span',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'blockquote',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'hr',
];
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName !== 'IMG') return;
  const source = node.getAttribute('src') || '';
  if (MANAGED_IMAGE.test(source)) {
    node.setAttribute('src', `supercard-media://local/${source}`);
    node.setAttribute('alt', node.getAttribute('alt') || 'Card image');
  } else {
    node.removeAttribute('src');
    node.setAttribute('alt', `Image unavailable: ${source || 'missing reference'}`);
  }
});
export function sanitizeCard(source: string): string {
  // HTML parsers must not consume TeX inequalities or matrix alignment characters.
  const protectedMath = source.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, (math) =>
    math
      .replace(/&(?!(?:#\d+|#x[\da-f]+|[a-z]+);)/gi, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'),
  );
  return DOMPurify.sanitize(protectedMath, {
    ALLOWED_TAGS: allowed,
    ALLOWED_ATTR: ['src', 'alt'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}
