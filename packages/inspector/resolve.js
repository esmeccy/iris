// Pure style-resolution logic. Runs in two places: unit tests (node) and the
// browser overlay, where the plugin serves it as /@iris/resolve. Keep it
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

// The cascadeKey components, in priority order, as human reasons. Index lines
// up with cascadeKey: [important, specificity, sheetOrder, rule line, decl line].
const KEY_REASONS = [
  '!important',
  'higher specificity',
  'later stylesheet (load order)',
  'later in source',
  'later in source',
];

// Why `winKey` beats `otherKey`: the first cascade component that differs.
function keyReason(winKey, otherKey) {
  for (let i = 0; i < winKey.length; i += 1) {
    if (winKey[i] !== otherKey[i]) return KEY_REASONS[i];
  }
  return 'later in source';
}

/**
 * Marks each declaration in the matched rules with `overridden: true|false` and
 * a `cascade` object describing the per-property contest:
 *   { contested, rank, total, winner?, reason?, winnerSelector? }
 * `contested` is true when more than one matched rule sets the same property.
 * The winner is decided by !important, then specificity, then stylesheet order,
 * then source order. Mutates and returns `matchedRules`.
 * No shorthand expansion: `padding` and `padding-top` are separate properties.
 */
export function resolveCascade(matchedRules) {
  const groups = new Map(); // prop -> [{ decl, rule, key }]

  for (const rule of matchedRules) {
    for (const decl of rule.declarations) {
      const entry = { decl, rule, key: cascadeKey(rule, decl) };
      if (!groups.has(decl.prop)) groups.set(decl.prop, []);
      groups.get(decl.prop).push(entry);
    }
  }

  for (const group of groups.values()) {
    // Strongest-first; line numbers make keys unique, so this is deterministic
    // and matches CSS "later wins" on otherwise-equal declarations.
    group.sort((a, b) => compareKeys(b.key, a.key));
    const winner = group[0];
    const contested = group.length > 1;
    group.forEach((entry, i) => {
      const { decl } = entry;
      decl.overridden = i > 0;
      decl.cascade = { contested, rank: i + 1, total: group.length };
      if (i === 0) {
        decl.cascade.winner = true;
        if (contested) decl.cascade.reason = keyReason(winner.key, group[1].key);
      } else {
        decl.cascade.winnerSelector = winner.rule.selector;
        decl.cascade.reason = keyReason(winner.key, entry.key);
      }
    });
  }
  return matchedRules;
}

/**
 * Plain-language location of an element within the viewport, e.g. "top-right"
 * or "center", from its measured layout. Pure so it can be unit-tested.
 * layout = { x, y, width, height, viewportWidth, viewportHeight }
 */
export function describeViewportRegion(layout) {
  if (!layout || !layout.viewportWidth || !layout.viewportHeight) return '';
  const cx = layout.x + layout.width / 2;
  const cy = layout.y + layout.height / 2;
  const col = cx < layout.viewportWidth / 3 ? 'left' : cx < (layout.viewportWidth * 2) / 3 ? 'center' : 'right';
  const row = cy < layout.viewportHeight / 3 ? 'top' : cy < (layout.viewportHeight * 2) / 3 ? 'middle' : 'bottom';
  if (row === 'middle' && col === 'center') return 'center';
  if (col === 'center') return `${row}-center`;
  if (row === 'middle') return `${col} (vertically centered)`;
  return `${row}-${col}`;
}

/**
 * Formats the selected element's facts as markdown for pasting to an AI.
 * Pure function: the overlay assembles `ctx` from DOM/index data.
 * ctx = {
 *   component, source, breadcrumb: [names], tag, classes: [names],
 *   element: { kind, text, attributes: {k: v} },           // optional
 *   layout: { x, y, width, height, viewportWidth, viewportHeight }, // optional
 *   rules: [{ selector, file, line, declarations: [{ prop, value, important, overridden }] }],
 *   tokens: [{ name, effective, definedIn, conflicts: [{ value, location }] }],
 * }
 */
export function formatAiContext(ctx) {
  const lines = [];

  // 1. Identity — a compact handle the AI can use to refer back to this exact
  //    element (selector, component + file:line, structural path, visible text).
  lines.push(`## ${ctx.component ? `<${ctx.component}>` : `<${ctx.tag}>`} (context from Iris)`);
  lines.push('');
  const classAttr = ctx.classes?.length ? ` class="${ctx.classes.join(' ')}"` : '';
  const e = ctx.element || {};
  lines.push(`- **Element:** \`<${ctx.tag}${classAttr}>\`${e.kind ? ` — ${e.kind}` : ''}`);
  if (e.text) lines.push(`- **Text:** "${e.text}"`);
  if (ctx.component) lines.push(`- **Component:** <${ctx.component}> — ${ctx.source}`);
  if (ctx.breadcrumb?.length) lines.push(`- **Path:** ${ctx.breadcrumb.join(' › ')}`);
  const attrs = Object.entries(e.attributes ?? {});
  if (attrs.length) lines.push(`- **Attributes:** ${attrs.map(([k, v]) => `${k}="${v}"`).join(', ')}`);
  if (ctx.layout) {
    const region = describeViewportRegion(ctx.layout);
    lines.push(
      `- **On screen:** ${region ? `${region}, ` : ''}${Math.round(ctx.layout.width)}×${Math.round(ctx.layout.height)}px`,
    );
  }

  // 2. The CSS that actually applies, with file:line so the AI edits the right
  //    place. Overridden declarations are omitted to keep it actionable.
  lines.push('');
  lines.push('### CSS that styles it');
  let any = false;
  for (const rule of ctx.rules ?? []) {
    const winning = rule.declarations.filter((decl) => !decl.overridden);
    if (!winning.length) continue;
    any = true;
    lines.push('');
    lines.push(`\`${rule.selector}\` — ${rule.file}:${rule.line}`);
    for (const decl of winning) {
      lines.push(`  ${decl.prop}: ${decl.value}${decl.important ? ' !important' : ''};`);
    }
  }
  if (!any) {
    lines.push('');
    lines.push('(no rules in src/ match this element)');
  }

  // 3. Design tokens, so theme-wide changes go to the token, not the usage.
  if (ctx.tokens?.length) {
    lines.push('');
    lines.push('### Design tokens used');
    for (const token of ctx.tokens) {
      const definedIn = token.definedIn ? ` — ${token.definedIn}` : '';
      lines.push(`- ${token.name} = ${token.effective}${definedIn}`);
    }
  }

  return lines.join('\n');
}
