import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCssIndex } from './css-index.js';

let root;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'devlens-'));
  const styles = path.join(root, 'src', 'styles');
  fs.mkdirSync(styles, { recursive: true });
  fs.writeFileSync(
    path.join(styles, 'a.css'),
    [
      ':root {',
      '  --color-primary: #111111;',
      '}',
      '',
      '.button {',
      '  color: var(--color-primary);',
      '  padding: 8px !important;',
      '}',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(styles, 'b.css'),
    [':root {', '  --color-primary: #222222;', '}', ''].join('\n'),
  );
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('buildCssIndex', () => {
  it('indexes rules with selector, file and line', () => {
    const index = buildCssIndex(root);
    const button = index.rules.find((rule) => rule.selector === '.button');
    expect(button).toMatchObject({ file: 'src/styles/a.css', line: 5 });
    expect(button.declarations).toEqual([
      { prop: 'color', value: 'var(--color-primary)', important: false, line: 6 },
      { prop: 'padding', value: '8px', important: true, line: 7 },
    ]);
  });

  it('collects every definition site of a custom property', () => {
    const index = buildCssIndex(root);
    expect(index.tokens['--color-primary']).toEqual([
      { file: 'src/styles/a.css', line: 2, value: '#111111', selector: ':root' },
      { file: 'src/styles/b.css', line: 2, value: '#222222', selector: ':root' },
    ]);
  });

  it('records scanned files in deterministic order', () => {
    const index = buildCssIndex(root);
    expect(index.fileOrder).toEqual(['src/styles/a.css', 'src/styles/b.css']);
  });

  it('returns an empty index when src/ has no CSS', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'devlens-empty-'));
    try {
      expect(buildCssIndex(empty)).toEqual({ fileOrder: [], rules: [], tokens: {} });
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});
