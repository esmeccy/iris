import { describe, expect, it } from 'vitest';
import devlensInspector from './index.js';

function makePlugin(root = '/proj') {
  const plugin = devlensInspector();
  plugin.configResolved({ root });
  return plugin;
}

describe('devlensInspector plugin', () => {
  it('is dev-only and runs before other transforms', () => {
    const plugin = makePlugin();
    expect(plugin.apply).toBe('serve');
    expect(plugin.enforce).toBe('pre');
  });

  it('injects the overlay script tag into index.html', () => {
    expect(makePlugin().transformIndexHtml()).toEqual([
      { tag: 'script', attrs: { type: 'module', src: '/@devlens/overlay' }, injectTo: 'body' },
    ]);
  });

  it('serves the overlay module with the project root baked in', () => {
    const plugin = makePlugin();
    expect(plugin.resolveId('/@devlens/overlay')).toBe('/@devlens/overlay');
    expect(plugin.resolveId('/src/App.jsx')).toBeUndefined();

    const code = plugin.load('/@devlens/overlay');
    expect(code).toContain('function initDevlensOverlay');
    expect(code).toContain('initDevlensOverlay({"root":"/proj"})');
  });

  it('serves the shared resolve module', () => {
    const plugin = makePlugin();
    expect(plugin.resolveId('/@devlens/resolve')).toBe('/@devlens/resolve');
    expect(plugin.load('/@devlens/resolve')).toContain('export function resolveCascade');
  });

  it('transforms jsx under root/src only', () => {
    const plugin = makePlugin();
    const out = plugin.transform('const App = () => <div className="x" />;', '/proj/src/App.jsx');
    expect(out.code).toContain('data-devlens-source="src/App.jsx:1"');
    expect(out.code).toContain('data-devlens-component="App"');

    expect(plugin.transform('const A = () => <div />;', '/proj/lib/A.jsx')).toBeNull();
    expect(plugin.transform('const A = () => <div />;', '/proj/node_modules/x/src/A.jsx')).toBeNull();
  });
});
