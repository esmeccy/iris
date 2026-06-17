import { describe, expect, it } from 'vitest';
import {
  classifyCrumb,
  classifySourceFile,
  describeViewportRegion,
  explainDeclaration,
  extractVarRefs,
  formatAiContext,
  resolveCascade,
  specificity,
} from './resolve.js';

describe('classifySourceFile', () => {
  it('marks route-entry files as pages', () => {
    expect(classifySourceFile('index.html')).toBe('page');
    expect(classifySourceFile('game.html')).toBe('page');
    expect(classifySourceFile('src/index.jsx')).toBe('page');
    expect(classifySourceFile('src/pages/About.jsx')).toBe('page');
    expect(classifySourceFile('src/routes/home.jsx')).toBe('page');
    expect(classifySourceFile('src/views/Settings.jsx')).toBe('page');
  });

  it('marks everything else as components', () => {
    expect(classifySourceFile('src/App.jsx')).toBe('component');
    expect(classifySourceFile('src/components/Button.jsx')).toBe('component');
    expect(classifySourceFile('src/components/CardIndex.jsx')).toBe('component');
  });
});

describe('classifyCrumb', () => {
  it('treats the App root as the page, not a component', () => {
    expect(
      classifyCrumb({ name: 'App', file: 'src/App.jsx', isComponent: true, isRoot: true }),
    ).toBe('page');
  });

  it('keeps reusable building blocks as components', () => {
    expect(
      classifyCrumb({
        name: 'Button',
        file: 'src/components/Button.jsx',
        isComponent: true,
        isRoot: false,
      }),
    ).toBe('component');
    // A nested component that happens to be named App is not the page root.
    expect(
      classifyCrumb({ name: 'App', file: 'src/widgets/App.jsx', isComponent: true, isRoot: false }),
    ).toBe('component');
  });

  it('classifies page files as pages even when nested', () => {
    expect(
      classifyCrumb({
        name: 'About',
        file: 'src/pages/About.jsx',
        isComponent: true,
        isRoot: false,
      }),
    ).toBe('page');
  });

  it('classifies plain-HTML crumbs as page root or element', () => {
    expect(
      classifyCrumb({ name: 'body', file: 'game.html', isComponent: false, isRoot: true }),
    ).toBe('page');
    expect(
      classifyCrumb({ name: 'button', file: 'game.html', isComponent: false, isRoot: false }),
    ).toBe('element');
  });
});

describe('explainDeclaration', () => {
  it('annotates known properties', () => {
    expect(explainDeclaration('padding', '8px')).toBe('inner spacing');
    expect(explainDeclaration('display', 'flex')).toBe('lay out children with flexbox');
    expect(explainDeclaration('position', 'fixed')).toBe('pinned to the viewport');
    expect(explainDeclaration('margin-top', '4px')).toBe('outer spacing (top)');
    expect(explainDeclaration('--color-primary', '#fff')).toBe('design token definition');
  });

  it('returns an empty string for unknown properties', () => {
    expect(explainDeclaration('contain-intrinsic-size', 'auto')).toBe('');
  });
});

describe('specificity', () => {
  it('orders id > class > type', () => {
    expect(specificity('#x')).toBeGreaterThan(specificity('.a.b.c'));
    expect(specificity('.a.b')).toBeGreaterThan(specificity('.a'));
    expect(specificity('.a')).toBeGreaterThan(specificity('button'));
    expect(specificity('button.a')).toBeGreaterThan(specificity('.a'));
  });

  it('counts attributes and pseudo-classes like classes', () => {
    expect(specificity('[disabled]')).toBe(specificity('.a'));
    expect(specificity('a:hover')).toBe(specificity('a.x'));
  });
});

describe('extractVarRefs', () => {
  it('finds every custom property referenced, including fallbacks', () => {
    expect(extractVarRefs('var(--a) solid var(--b, var(--c))')).toEqual(['--a', '--b', '--c']);
  });

  it('deduplicates and ignores non-var values', () => {
    expect(extractVarRefs('var(--a) var(--a)')).toEqual(['--a']);
    expect(extractVarRefs('1px solid #fff')).toEqual([]);
  });
});

describe('resolveCascade', () => {
  const rule = (selector, sheetOrder, line, declarations) => ({
    selector,
    sheetOrder,
    line,
    declarations,
  });

  it('later stylesheet wins at equal specificity', () => {
    const [a, b] = resolveCascade([
      rule('.button', 0, 10, [{ prop: 'background', value: 'red', important: false, line: 11 }]),
      rule('.button', 1, 5, [{ prop: 'background', value: 'blue', important: false, line: 6 }]),
    ]);
    expect(a.declarations[0].overridden).toBe(true);
    expect(b.declarations[0].overridden).toBe(false);
  });

  it('higher specificity beats later order', () => {
    const [a, b] = resolveCascade([
      rule('.button.primary', 0, 1, [{ prop: 'color', value: 'red', important: false, line: 2 }]),
      rule('.button', 1, 1, [{ prop: 'color', value: 'blue', important: false, line: 2 }]),
    ]);
    expect(a.declarations[0].overridden).toBe(false);
    expect(b.declarations[0].overridden).toBe(true);
  });

  it('!important beats specificity', () => {
    const [a, b] = resolveCascade([
      rule('.x', 0, 1, [{ prop: 'color', value: 'red', important: true, line: 2 }]),
      rule('#y.x', 1, 1, [{ prop: 'color', value: 'blue', important: false, line: 2 }]),
    ]);
    expect(a.declarations[0].overridden).toBe(false);
    expect(b.declarations[0].overridden).toBe(true);
  });

  it('different properties never override each other', () => {
    const [a, b] = resolveCascade([
      rule('.x', 0, 1, [{ prop: 'color', value: 'red', important: false, line: 2 }]),
      rule('.x', 1, 5, [{ prop: 'background', value: 'blue', important: false, line: 6 }]),
    ]);
    expect(a.declarations[0].overridden).toBe(false);
    expect(b.declarations[0].overridden).toBe(false);
  });

  it('marks a single declaration as uncontested', () => {
    const [a] = resolveCascade([
      rule('.x', 0, 1, [{ prop: 'color', value: 'red', important: false, line: 2 }]),
    ]);
    expect(a.declarations[0].cascade).toMatchObject({ contested: false, winner: true, rank: 1, total: 1 });
    expect(a.declarations[0].cascade.reason).toBeUndefined();
  });

  it('explains why the winner wins and the loser loses on a contested property', () => {
    const [a, b] = resolveCascade([
      rule('.button.primary', 0, 1, [{ prop: 'color', value: 'red', important: false, line: 2 }]),
      rule('.button', 1, 1, [{ prop: 'color', value: 'blue', important: false, line: 2 }]),
    ]);
    expect(a.declarations[0].cascade).toMatchObject({
      contested: true,
      winner: true,
      reason: 'higher specificity',
    });
    expect(b.declarations[0].cascade).toMatchObject({
      contested: true,
      winnerSelector: '.button.primary',
      reason: 'higher specificity',
    });
  });
});

describe('describeViewportRegion', () => {
  const vp = { viewportWidth: 1200, viewportHeight: 900 };
  it('names corners', () => {
    expect(describeViewportRegion({ x: 0, y: 0, width: 100, height: 50, ...vp })).toBe('top-left');
    expect(describeViewportRegion({ x: 1100, y: 850, width: 80, height: 40, ...vp })).toBe('bottom-right');
  });
  it('names the center', () => {
    expect(describeViewportRegion({ x: 560, y: 430, width: 80, height: 40, ...vp })).toBe('center');
  });
  it('returns empty without viewport size', () => {
    expect(describeViewportRegion({ x: 0, y: 0, width: 10, height: 10 })).toBe('');
  });
});

describe('formatAiContext', () => {
  const ctx = {
    component: 'Button',
    source: 'src/components/Button.jsx:3',
    breadcrumb: ['App', 'Section', 'Card', 'Button'],
    tag: 'button',
    classes: ['button', 'button--primary'],
    rules: [
      {
        selector: '.button--primary',
        file: 'src/styles/components.css',
        line: 74,
        declarations: [
          { prop: 'background', value: 'var(--color-primary)', important: false, overridden: false },
        ],
      },
      {
        selector: '.button',
        file: 'src/styles/components.css',
        line: 64,
        declarations: [
          { prop: 'background', value: 'var(--color-surface)', important: false, overridden: true },
          { prop: 'cursor', value: 'pointer', important: false, overridden: false },
        ],
      },
    ],
    tokens: [
      {
        name: '--color-primary',
        effective: '#d946ef',
        definedIn: 'src/styles/legacy.css:5',
        conflicts: [{ value: '#4f46e5', location: 'src/styles/global.css:2' }],
      },
    ],
  };

  it('renders a concise identity + CSS handoff', () => {
    const text = formatAiContext(ctx);
    expect(text).toContain('- **Element:** `<button class="button button--primary">`');
    expect(text).toContain('- **Component:** <Button> — src/components/Button.jsx:3');
    expect(text).toContain('- **Path:** App › Section › Card › Button');
    expect(text).toContain('`.button--primary` — src/styles/components.css:74');
    expect(text).toContain('`.button` — src/styles/components.css:64');
    expect(text).toContain('  cursor: pointer;');
    expect(text).toContain('- --color-primary = #d946ef — src/styles/legacy.css:5');
  });

  it('omits overridden declarations from the CSS', () => {
    const text = formatAiContext(ctx);
    expect(text).not.toContain('var(--color-surface)'); // overridden — dropped
    expect(text).not.toContain('overridden');
  });

  it('handles an element with no matched rules or tokens', () => {
    const text = formatAiContext({
      component: 'App',
      source: 'src/App.jsx:13',
      breadcrumb: ['App'],
      tag: 'main',
      classes: [],
      rules: [],
      tokens: [],
    });
    expect(text).toContain('- **Element:** `<main>`');
    expect(text).toContain('(no rules in src/ match this element)');
    expect(text).not.toContain('### Design tokens');
  });
});
