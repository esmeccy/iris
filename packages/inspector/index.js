import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCssIndex } from './css-index.js';
import { tagHtmlSource } from './tag-html.js';
import { tagJsxSource } from './tag-jsx.js';

export { tagHtmlSource } from './tag-html.js';
export { tagJsxSource } from './tag-jsx.js';

const OVERLAY_ID = '/@iris/overlay';
const OVERLAY_FILE = fileURLToPath(new URL('./overlay.js', import.meta.url));
const RESOLVE_ID = '/@iris/resolve';
const RESOLVE_FILE = fileURLToPath(new URL('./resolve.js', import.meta.url));
const CSS_INDEX_URL = '/@iris/css-index';

export default function irisPlugin() {
  let root = process.cwd();

  const relPath = (file) => path.relative(root, file).split(path.sep).join('/');

  return {
    name: 'vite-plugin-iris',
    apply: 'serve',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.jsx')) return null;
      if (file.includes('node_modules')) return null;

      const srcDir = path.resolve(root, 'src');
      if (!file.startsWith(srcDir + path.sep)) return null;

      return tagJsxSource(code, relPath(file));
    },

    transformIndexHtml: {
      // 'pre' runs on the on-disk HTML, before Vite's own injections, so the
      // tagged line numbers always refer to the real source file.
      order: 'pre',
      handler(html, ctx) {
        return {
          html: tagHtmlSource(html, relPath(ctx.filename.split('?')[0])),
          tags: [
            {
              tag: 'script',
              attrs: { type: 'module', src: OVERLAY_ID },
              injectTo: 'body',
            },
          ],
        };
      },
    },

    resolveId(id) {
      if (id === OVERLAY_ID || id === RESOLVE_ID) return id;
    },

    load(id) {
      if (id === RESOLVE_ID) return fs.readFileSync(RESOLVE_FILE, 'utf8');
      if (id !== OVERLAY_ID) return null;
      const source = fs.readFileSync(OVERLAY_FILE, 'utf8');
      return `${source}\ninitIrisOverlay(${JSON.stringify({ root })});\n`;
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== CSS_INDEX_URL) return next();
        res.setHeader('Content-Type', 'application/json');
        // Rebuilt on every request: always fresh after CSS edits, and cheap
        // at the scale of one project's stylesheets.
        res.end(JSON.stringify(buildCssIndex(root)));
      });
    },
  };
}
