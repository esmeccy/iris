import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import MagicString from 'magic-string';

const OVERLAY_ID = '/@devlens/overlay';
const OVERLAY_FILE = fileURLToPath(new URL('./overlay.js', import.meta.url));

const isComponentName = (name) => /^[A-Z]/.test(name);

// Pure metadata keys on Babel nodes; everything else may hold child nodes.
const SKIP_KEYS = new Set([
  'loc',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'extra',
]);

function walk(node, stack, onOpeningElement) {
  if (!node || typeof node.type !== 'string') return;

  let pushed = false;
  if (node.type === 'FunctionDeclaration' && node.id && isComponentName(node.id.name)) {
    stack.push(node.id.name);
    pushed = true;
  } else if (
    node.type === 'VariableDeclarator' &&
    node.id.type === 'Identifier' &&
    isComponentName(node.id.name) &&
    node.init &&
    (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
  ) {
    stack.push(node.id.name);
    pushed = true;
  }

  if (node.type === 'JSXOpeningElement') onOpeningElement(node, stack);

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) walk(child, stack, onOpeningElement);
    } else if (value && typeof value === 'object') {
      walk(value, stack, onOpeningElement);
    }
  }

  if (pushed) stack.pop();
}

/**
 * Tags every native (lowercase) JSX element in `code` with
 * data-devlens-source="<relPath>:<line>" and data-devlens-component="<Name>".
 * Insertions only — the rest of the source stays byte-identical.
 * Returns { code, map } or null when nothing was tagged.
 */
export function tagJsxSource(code, relPath) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const s = new MagicString(code);
  const fallbackName = path.basename(relPath).replace(/\.[^.]+$/, '');
  let tagged = false;

  walk(ast.program, [], (node, stack) => {
    if (node.name.type !== 'JSXIdentifier' || !/^[a-z]/.test(node.name.name)) return;
    const component = stack[stack.length - 1] ?? fallbackName;
    const line = node.loc.start.line;
    s.appendLeft(
      node.name.end,
      ` data-devlens-source="${relPath}:${line}" data-devlens-component="${component}"`,
    );
    tagged = true;
  });

  if (!tagged) return null;
  return { code: s.toString(), map: s.generateMap({ hires: true }) };
}

export default function devlensInspector() {
  let root = process.cwd();

  return {
    name: 'devlens-inspector',
    apply: 'serve',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: OVERLAY_ID },
          injectTo: 'body',
        },
      ];
    },

    resolveId(id) {
      if (id === OVERLAY_ID) return OVERLAY_ID;
    },

    load(id) {
      if (id !== OVERLAY_ID) return null;
      const source = fs.readFileSync(OVERLAY_FILE, 'utf8');
      return `${source}\ninitDevlensOverlay(${JSON.stringify({ root })});\n`;
    },

    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.jsx')) return null;
      if (file.includes('node_modules')) return null;

      const srcDir = path.resolve(root, 'src');
      if (!file.startsWith(srcDir + path.sep)) return null;

      const relPath = path.relative(root, file).split(path.sep).join('/');
      return tagJsxSource(code, relPath);
    },
  };
}
