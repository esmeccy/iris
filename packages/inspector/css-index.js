import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

function collectCssFiles(dir) {
  let out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(collectCssFiles(full));
    else if (entry.name.endsWith('.css')) out.push(full);
  }
  return out;
}

/**
 * Scans every .css file under <root>/src and builds the static style index:
 *   fileOrder — scanned files (project-relative), deterministic order
 *   rules     — { file, line, selector, declarations: [{ prop, value, important, line }] }
 *   tokens    — custom property name → [{ file, line, value, selector }]
 * Cascade order between files is NOT decided here: the overlay reads the real
 * order from the DOM (Vite's style[data-vite-dev-id] tags) at runtime.
 */
export function buildCssIndex(root) {
  const fileOrder = [];
  const rules = [];
  const tokens = {};

  const files = collectCssFiles(path.resolve(root, 'src')).sort();
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    let ast;
    try {
      ast = postcss.parse(fs.readFileSync(abs, 'utf8'), { from: abs });
    } catch {
      continue; // a syntax error in one file shouldn't kill the index
    }
    fileOrder.push(rel);

    ast.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;

      const declarations = [];
      for (const node of rule.nodes ?? []) {
        if (node.type !== 'decl') continue;
        const line = node.source?.start?.line ?? rule.source?.start?.line ?? 1;
        declarations.push({
          prop: node.prop,
          value: node.value,
          important: Boolean(node.important),
          line,
        });
        if (node.prop.startsWith('--')) {
          (tokens[node.prop] ??= []).push({
            file: rel,
            line,
            value: node.value.trim(),
            selector: rule.selector,
          });
        }
      }

      rules.push({
        file: rel,
        line: rule.source?.start?.line ?? 1,
        selector: rule.selector,
        declarations,
      });
    });
  }

  return { fileOrder, rules, tokens };
}
