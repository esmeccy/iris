import { describe, expect, it } from 'vitest';
import { tagHtmlSource } from './tag-html.js';

const fixture = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <title>Demo</title>',
  '    <link rel="stylesheet" href="/css/a.css" />',
  '    <style>.x { color: red; }</style>',
  '  </head>',
  '  <body>',
  '    <main class="page">',
  '      <button class="button">Hi</button>',
  '    </main>',
  '    <script type="module" src="/main.js"></script>',
  '  </body>',
  '</html>',
  '',
].join('\n');

describe('tagHtmlSource', () => {
  const result = tagHtmlSource(fixture, 'index.html');

  it('tags body content with file and line', () => {
    expect(result).toContain('<body data-devlens-source="index.html:8">');
    expect(result).toContain('<main data-devlens-source="index.html:9" class="page">');
    expect(result).toContain('<button data-devlens-source="index.html:10" class="button">');
  });

  it('never tags structural, head or script/style elements', () => {
    expect(result).not.toMatch(/<(html|head|title|link|style|script)[^>]*data-devlens/);
  });

  it('adds no component attribute (plain HTML has no components)', () => {
    expect(result).not.toContain('data-devlens-component');
  });

  it('keeps the rest of the markup byte-identical', () => {
    const stripped = result.replace(/ data-devlens-source="[^"]*"/g, '');
    expect(stripped).toBe(fixture);
  });

  it('returns the input unchanged when nothing is taggable', () => {
    const headOnly = '<!doctype html><html><head><title>x</title></head></html>';
    expect(tagHtmlSource(headOnly, 'index.html')).toContain('<title>x</title>');
    expect(tagHtmlSource(headOnly, 'index.html')).not.toContain('data-devlens-source');
  });
});
