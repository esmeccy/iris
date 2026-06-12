// Pure style-resolution logic. Runs in two places: unit tests (node) and the
// browser overlay, where the plugin serves it as /@devlens/resolve. Keep it
// free of DOM and node APIs.

// Plain-language annotations for designers — shown BESIDE the verbatim code,
// never instead of it. Static dictionary on principle: no AI, no network.
const PROPERTY_NOTES = {
  padding: 'inner spacing',
  margin: 'outer spacing',
  gap: 'space between children',
  'border-radius': 'corner rounding',
  border: 'outline stroke',
  outline: 'focus outline',
  background: 'fill',
  'background-color': 'fill color',
  color: 'text color',
  font: 'typeface, size and line height',
  'font-family': 'typeface',
  'font-size': 'text size',
  'font-weight': 'text thickness',
  'font-style': 'italic/normal',
  'line-height': 'vertical text spacing',
  'letter-spacing': 'space between letters',
  'text-transform': 'letter casing',
  'text-decoration': 'underline/strike styling',
  'text-align': 'text alignment',
  'white-space': 'text wrapping behavior',
  'box-shadow': 'drop shadow',
  opacity: 'transparency',
  width: 'element width',
  height: 'element height',
  'max-width': 'maximum width',
  'max-height': 'maximum height',
  'min-width': 'minimum width',
  'min-height': 'minimum height',
  'align-items': 'cross-axis alignment of children',
  'justify-content': 'main-axis distribution of children',
  'flex-direction': 'row or column layout',
  'flex-wrap': 'allow children to wrap',
  flex: 'how much it grows/shrinks',
  'grid-template-columns': 'column layout of the grid',
  'grid-template-rows': 'row layout of the grid',
  overflow: 'clipping/scroll behavior',
  cursor: 'mouse cursor style',
  'z-index': 'stacking order',
  'box-sizing': 'how width/height are measured',
  'pointer-events': 'whether it reacts to the mouse',
  transition: 'animation between states',
  transform: 'move/scale/rotate',
};

const DISPLAY_NOTES = {
  flex: 'lay out children with flexbox',
  'inline-flex': 'inline flexbox container',
  grid: 'lay out children on a grid',
  'inline-grid': 'inline grid container',
  block: 'full-width block',
  'inline-block': 'inline, but sizeable',
  inline: 'flows with text',
  none: 'hidden (removed from layout)',
};

const POSITION_NOTES = {
  fixed: 'pinned to the viewport',
  absolute: 'positioned against its nearest positioned ancestor',
  relative: 'normal position, offsettable',
  sticky: 'scrolls, then sticks',
  static: 'normal document flow',
};

export function explainDeclaration(prop, value) {
  if (prop.startsWith('--')) return 'design token definition';
  const v = String(value).trim().toLowerCase();
  if (prop === 'display') return DISPLAY_NOTES[v] || 'layout mode';
  if (prop === 'position') return POSITION_NOTES[v] || 'positioning mode';
  const side = prop.match(/^(margin|padding|border)-(top|right|bottom|left)$/);
  if (side) return `${PROPERTY_NOTES[side[1]]} (${side[2]})`;
  return PROPERTY_NOTES[prop] || '';
}

/**
 * Classifies a source file for breadcrumb badges: 'page' for route-entry
 * files (.html pages, index.* entries, anything under pages/ routes/ views/),
 * 'component' for everything else.
 */
export function classifySourceFile(file) {
  if (/\.html?$/i.test(file)) return 'page';
  const base = file.split('/').pop().replace(/\.[^.]+$/, '');
  if (base.toLowerCase() === 'index') return 'page';
  if (/(^|\/)(pages|routes|views)(\/|$)/.test(file)) return 'page';
  return 'component';
}

// One shared vocabulary across the whole overlay, written for non-coders.
// Shown when hovering a kind badge — teaching as a side effect.
export const KIND_NOTES = {
  page: 'A screen of your app — what a visitor sees at one URL.',
  component: 'A reusable building block of your app, defined in your code.',
  element: 'A basic HTML building block the browser provides (div, button, …).',
};

/**
 * Classifies one breadcrumb level as 'page' | 'component' | 'element'.
 * - Raw HTML tags are elements; the root of an .html file is the page.
 * - Components from page files (and root components named App/Root) are pages
 *   — designers think of the app root as "the page", not a component.
 */
export function classifyCrumb({ name, file, isComponent, isRoot }) {
  if (!isComponent) return isRoot && /\.html?$/i.test(file) ? 'page' : 'element';
  if (classifySourceFile(file) === 'page') return 'page';
  if (isRoot && /^(App|Root)$/.test(name)) return 'page';
  return 'component';
}

/**
 * Selector specificity as a single comparable number:
 * ids * 1e6 + (classes + attributes + pseudo-classes) * 1e3 + types.
 * Rough by design — combinators ignored, :not() contents counted, which is
 * close enough for cascade ordering at MVP scale.
 */
export function specificity(selector) {
  let s = selector;
  let ids = 0;
  let classes = 0;
  let types = 0;

  s = s.replace(/#[\w-]+/g, () => ((ids += 1), ''));
  s = s.replace(/\[[^\]]*\]/g, () => ((classes += 1), ''));
  s = s.replace(/\.[\w-]+/g, () => ((classes += 1), ''));
  s = s.replace(/::[\w-]+/g, () => ((types += 1), ''));
  s = s.replace(/:[\w-]+(\([^)]*\))?/g, () => ((classes += 1), ''));
  s.replace(/(^|[\s>+~(,])([a-zA-Z][\w-]*)/g, () => ((types += 1), ''));

  return ids * 1e6 + classes * 1e3 + types;
}

export function extractVarRefs(value) {
  const refs = [];
  for (const match of String(value).matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!refs.includes(match[1])) refs.push(match[1]);
  }
  return refs;
}

function cascadeKey(rule, decl) {
  return [decl.important ? 1 : 0, specificity(rule.selector), rule.sheetOrder ?? 0, rule.line, decl.line];
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Marks each declaration in the matched rules with `overridden: true|false` —
 * per property, the winner is decided by !important, then specificity, then
 * stylesheet order, then source order. Mutates and returns `matchedRules`.
 * No shorthand expansion: `padding` and `padding-top` are separate properties.
 */
export function resolveCascade(matchedRules) {
  const best = new Map();
  const entries = [];

  for (const rule of matchedRules) {
    for (const decl of rule.declarations) {
      const key = cascadeKey(rule, decl);
      entries.push({ decl, key });
      const current = best.get(decl.prop);
      if (!current || compareKeys(key, current) >= 0) best.set(decl.prop, key);
    }
  }
  for (const { decl, key } of entries) {
    decl.overridden = compareKeys(key, best.get(decl.prop)) < 0;
  }
  return matchedRules;
}

/**
 * Formats the selected element's facts as markdown for pasting to an AI.
 * Pure function: the overlay assembles `ctx` from DOM/index data.
 * ctx = {
 *   component, source, breadcrumb: [names], tag, classes: [names],
 *   rules: [{ selector, file, line, declarations: [{ prop, value, important, overridden }] }],
 *   tokens: [{ name, effective, definedIn, conflicts: [{ value, location }] }],
 * }
 */
export function formatAiContext(ctx) {
  const lines = [];
  lines.push('## UI element context (generated by DevLens)');
  lines.push('');
  lines.push(`- Component: <${ctx.component}> — ${ctx.source}`);
  if (ctx.breadcrumb?.length) lines.push(`- Component path: ${ctx.breadcrumb.join(' › ')}`);
  const classAttr = ctx.classes?.length ? ` class="${ctx.classes.join(' ')}"` : '';
  lines.push(`- DOM element: <${ctx.tag}${classAttr}>`);

  lines.push('');
  lines.push('### Applied CSS rules (winning rules first)');
  if (!ctx.rules?.length) {
    lines.push('');
    lines.push('(no rules in src/ match this element)');
  }
  for (const rule of ctx.rules ?? []) {
    lines.push('');
    lines.push(`${rule.selector} — ${rule.file}:${rule.line}`);
    for (const decl of rule.declarations) {
      const important = decl.important ? ' !important' : '';
      const overridden = decl.overridden ? '  [overridden — loses the cascade]' : '';
      lines.push(`  ${decl.prop}: ${decl.value}${important};${overridden}`);
    }
  }

  if (ctx.tokens?.length) {
    lines.push('');
    lines.push('### Design tokens used by this element');
    for (const token of ctx.tokens) {
      const definedIn = token.definedIn ? ` (defined in ${token.definedIn})` : '';
      lines.push(`- ${token.name} = ${token.effective}${definedIn}`);
      for (const conflict of token.conflicts ?? []) {
        lines.push(
          `  - ⚠ also defined as ${conflict.value} in ${conflict.location} — overridden by load order`,
        );
      }
    }
  }

  lines.push('');
  lines.push(
    'To change how this element looks, edit the source files referenced above (component for structure/props, CSS rules for styling, token definitions for theme-wide values).',
  );
  return lines.join('\n');
}
