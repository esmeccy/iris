import MagicString from 'magic-string';
import { parse } from 'parse5';

// Structural/head-only tags that never need source tagging. Body content is
// tagged including <body> itself, so dynamically created DOM still resolves
// to a tagged ancestor via the overlay's closest() walk.
const SKIP_TAGS = new Set([
  'html',
  'head',
  'base',
  'link',
  'meta',
  'title',
  'script',
  'style',
  'template',
  'noscript',
]);

/**
 * Tags every taggable element in an HTML document with
 * data-devlens-source="<relPath>:<line>". No component attribute: plain HTML
 * has no components, and the overlay falls back to the element's tag name.
 * Insertions only — the rest of the markup stays byte-identical.
 */
export function tagHtmlSource(html, relPath) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const s = new MagicString(html);
  let tagged = false;

  const visit = (node) => {
    if (node.tagName && !SKIP_TAGS.has(node.tagName)) {
      // Implicit elements (e.g. a <body> parse5 invents) have no location.
      const startTag = node.sourceCodeLocation?.startTag;
      if (startTag) {
        s.appendLeft(
          startTag.startOffset + 1 + node.tagName.length,
          ` data-devlens-source="${relPath}:${startTag.startLine}"`,
        );
        tagged = true;
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(document);

  return tagged ? s.toString() : html;
}
