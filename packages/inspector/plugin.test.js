import { describe, expect, it } from 'vitest';
import irisPlugin from './index.js';

function makePlugin(root = '/proj') {
  const plugin = irisPlugin();
  plugin.configResolved({ root });
  return plugin;
}

describe('irisPlugin plugin', () => {
  it('is dev-only and runs before other transforms', () => {
    const plugin = makePlugin();
    expect(plugin.apply).toBe('serve');
    expect(plugin.enforce).toBe('pre');
  });

  it('tags served HTML and injects the overlay script tag', () => {
    const plugin = makePlugin();
    expect(plugin.transformIndexHtml.order).toBe('pre');

    const result = plugin.transformIndexHtml.handler(
      '<html><body>\n<div class="page"></div>\n</body></html>',
      { filename: '/proj/index.html' },
    );
    expect(result.html).toContain('<div data-iris-source="index.html:2" class="page">');
    expect(result.html).not.toContain('data-iris-component');
    expect(result.tags).toEqual([
      { tag: 'script', attrs: { type: 'module', src: '/@iris/overlay' }, injectTo: 'body' },
    ]);
  });

  it('serves the overlay module with the project root baked in', () => {
    const plugin = makePlugin();
    expect(plugin.resolveId('/@iris/overlay')).toBe('/@iris/overlay');
    expect(plugin.resolveId('/src/App.jsx')).toBeUndefined();

    const code = plugin.load('/@iris/overlay');
    expect(code).toContain('function initIrisOverlay');
    expect(code).toContain('initIrisOverlay({"root":"/proj"})');
  });

  it('serves the shared resolve module', () => {
    const plugin = makePlugin();
    expect(plugin.resolveId('/@iris/resolve')).toBe('/@iris/resolve');
    expect(plugin.load('/@iris/resolve')).toContain('export function resolveCascade');
  });

  it('transforms jsx under root/src only', () => {
    const plugin = makePlugin();
    const out = plugin.transform('const App = () => <div className="x" />;', '/proj/src/App.jsx');
    expect(out.code).toContain('data-iris-source="src/App.jsx:1"');
    expect(out.code).toContain('data-iris-component="App"');

    expect(plugin.transform('const A = () => <div />;', '/proj/lib/A.jsx')).toBeNull();
    expect(plugin.transform('const A = () => <div />;', '/proj/node_modules/x/src/A.jsx')).toBeNull();
  });
});
