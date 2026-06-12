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
