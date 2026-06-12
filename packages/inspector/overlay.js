// Browser-side DevLens overlay. The plugin serves this file as the virtual
// module /@devlens/overlay and appends an initDevlensOverlay({ root }) call
// with the project's absolute path. All overlay UI lives inside one Shadow
// DOM host so page styles and overlay styles never touch each other.

import {
  explainDeclaration,
  extractVarRefs,
  formatAiContext,
  resolveCascade,
} from '/@devlens/resolve';

const SOURCE_ATTR = 'data-devlens-source';
const COMPONENT_ATTR = 'data-devlens-component';
const CSS_INDEX_URL = '/@devlens/css-index';

const STYLES = `
  * { box-sizing: border-box; }

  .box {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
  }
  .box--hover {
    border: 1.5px solid #4f8cff;
    background: rgba(79, 140, 255, 0.08);
  }
  .box--selected {
    border: 1.5px solid #a855f7;
  }

  .label {
    position: absolute;
    left: -1.5px;
    bottom: 100%;
    margin-bottom: 4px;
    padding: 2px 7px;
    border-radius: 4px;
    background: #1c2433;
    color: #fff;
    font: 11px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: nowrap;
  }
  .label--below {
    bottom: auto;
    top: 100%;
    margin: 4px 0 0;
  }

  .badge {
    position: fixed;
    left: 12px;
    bottom: 12px;
    padding: 6px 10px;
    border-radius: 6px;
    background: #1c2433;
    color: #fff;
    font: 12px/1.4 system-ui, sans-serif;
  }

  .panel {
    position: fixed;
    top: 12px;
    right: 12px;
    width: 380px;
    max-height: calc(100vh - 24px);
    overflow: auto;
    padding: 14px;
    border: 1px solid #e2e5ec;
    border-radius: 10px;
    background: #fff;
    color: #1c2433;
    font: 13px/1.5 system-ui, sans-serif;
    box-shadow: 0 8px 30px rgba(16, 24, 40, 0.12);
    pointer-events: auto;
  }

  .panel-head { display: flex; justify-content: space-between; gap: 8px; }
  .panel-title { font-weight: 600; font-size: 14px; font-family: ui-monospace, Menlo, monospace; }
  .panel-loc { color: #667085; font-family: ui-monospace, Menlo, monospace; font-size: 11px; margin-top: 2px; }
  .panel-close { border: 0; background: none; color: #667085; font-size: 14px; cursor: pointer; padding: 0 2px; }
  .panel-close:hover { color: #1c2433; }

  .crumbs { margin: 12px 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
  .crumb { border: 0; background: none; padding: 1px 3px; border-radius: 4px; color: #4f5b76; font: inherit; cursor: pointer; }
  .crumb:hover { background: #eef1f6; color: #1c2433; }
  .crumb--current { color: #7c3aed; font-weight: 600; }
  .crumb-sep { color: #98a2b3; }

  .panel-section h4 { margin: 12px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #667085; }
  .classes { display: flex; flex-wrap: wrap; gap: 4px; }
  .class-chip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: #f2f4f7; border: 1px solid #e2e5ec; border-radius: 4px; padding: 1px 6px; }
  .classes-empty { color: #98a2b3; }

  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .vscode { display: inline-block; padding: 6px 12px; border-radius: 6px; background: #1c2433; color: #fff; text-decoration: none; font-size: 12px; }
  .vscode:hover { background: #323d52; }
  .copy-context { padding: 6px 12px; border-radius: 6px; border: 1px solid #1c2433; background: #fff; color: #1c2433; font: 12px system-ui, sans-serif; cursor: pointer; }
  .copy-context:hover { background: #eef1f6; }

  .rule { margin-bottom: 10px; padding: 8px 10px; border: 1px solid #e2e5ec; border-radius: 6px; }
  .rule-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 4px; }
  .rule-sel { font-family: ui-monospace, Menlo, monospace; font-size: 12px; font-weight: 600; color: #1c2433; }
  .rule-loc { font-family: ui-monospace, Menlo, monospace; font-size: 10px; color: #667085; text-decoration: none; white-space: nowrap; }
  .rule-loc:hover { color: #7c3aed; text-decoration: underline; }

  .decl { margin: 3px 0; }
  .decl-code { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #334155; }
  .decl-note { margin-left: 6px; font-size: 11px; color: #98a2b3; font-style: italic; }
  .decl--overridden .decl-code { text-decoration: line-through; color: #98a2b3; }
  .decl--overridden .decl-note { display: none; }

  .token-chain { margin: 1px 0 3px 12px; font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; color: #475467; }
  .token-loc { color: #667085; }
  .conflict { display: block; color: #b54708; font-family: system-ui, sans-serif; font-size: 11px; }
  .styles-empty { color: #98a2b3; }
`;

export function initDevlensOverlay(config) {
  if (window.__devlensOverlay) return;
  window.__devlensOverlay = true;

  const projectRoot = String(config.root || '').replace(/\/+$/, '');

  let inspecting = false;
  let hoverEl = null;
  let selectedEl = null;
  let rafId = 0;

  const host = document.createElement('div');
  host.setAttribute('data-devlens-overlay', '');
  host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${STYLES}</style>
    <div class="box box--hover" hidden><span class="label"></span></div>
    <div class="box box--selected" hidden></div>
    <div class="badge" hidden>DevLens — hover to highlight, click to lock, Esc to exit</div>
    <aside class="panel" hidden>
      <header class="panel-head">
        <div>
          <div class="panel-title"></div>
          <div class="panel-loc"></div>
        </div>
        <button class="panel-close" type="button" title="Clear selection">✕</button>
      </header>
      <nav class="crumbs"></nav>
      <section class="panel-section">
        <h4>Classes</h4>
        <div class="classes"></div>
      </section>
      <section class="panel-section">
        <h4>Styles</h4>
        <div class="styles"></div>
      </section>
      <div class="actions">
        <a class="vscode" href="#">Open in VS Code</a>
        <button class="copy-context" type="button">Copy AI context</button>
      </div>
    </aside>
  `;
  document.body.appendChild(host);

  const hoverBox = shadow.querySelector('.box--hover');
  const hoverLabel = shadow.querySelector('.label');
  const selectedBox = shadow.querySelector('.box--selected');
  const badge = shadow.querySelector('.badge');
  const panel = shadow.querySelector('.panel');
  const panelTitle = shadow.querySelector('.panel-title');
  const panelLoc = shadow.querySelector('.panel-loc');
  const crumbsNav = shadow.querySelector('.crumbs');
  const classesBox = shadow.querySelector('.classes');
  const stylesBox = shadow.querySelector('.styles');
  const vscodeLink = shadow.querySelector('.vscode');
  const copyButton = shadow.querySelector('.copy-context');

  copyButton.addEventListener('click', onCopyContext);

  shadow.querySelector('.panel-close').addEventListener('click', () => {
    selectedEl = null;
    renderPanel();
    scheduleRender();
  });

  function sourceInfo(el) {
    const source = el.getAttribute(SOURCE_ATTR) || '';
    const i = source.lastIndexOf(':');
    return {
      file: i > 0 ? source.slice(0, i) : source,
      line: i > 0 ? source.slice(i + 1) : '',
      component: el.getAttribute(COMPONENT_ATTR) || '?',
    };
  }

  // Walk up from el collecting data-devlens-component, deduplicating
  // consecutive elements of the same component. Each crumb keeps the
  // closest element of that component so it can be re-selected.
  function componentChain(el) {
    const chain = [];
    for (let cur = el; cur; cur = cur.parentElement) {
      if (cur.hasAttribute(COMPONENT_ATTR)) {
        const name = cur.getAttribute(COMPONENT_ATTR);
        if (!chain.length || chain[chain.length - 1].name !== name) {
          chain.push({ name, el: cur });
        }
      }
    }
    return chain.reverse();
  }

  function isOverlayEvent(event) {
    return event.composedPath().includes(host);
  }

  function positionBox(box, el) {
    if (!el || !el.isConnected) {
      box.hidden = true;
      return;
    }
    const rect = el.getBoundingClientRect();
    box.hidden = false;
    box.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }

  function render() {
    rafId = 0;
    positionBox(hoverBox, hoverEl);
    positionBox(selectedBox, selectedEl);
    if (hoverEl && hoverEl.isConnected) {
      const { file, line, component } = sourceInfo(hoverEl);
      hoverLabel.textContent = `<${component}> · ${file}:${line}`;
      hoverLabel.classList.toggle('label--below', hoverEl.getBoundingClientRect().top < 30);
    }
  }

  function scheduleRender() {
    if (!rafId) rafId = requestAnimationFrame(render);
  }

  function renderPanel() {
    if (!selectedEl || !selectedEl.isConnected) {
      panel.hidden = true;
      return;
    }
    const { file, line, component } = sourceInfo(selectedEl);
    panelTitle.textContent = `<${component}>`;
    panelLoc.textContent = `${file}:${line}`;
    vscodeLink.href = `vscode://file${projectRoot}/${file}:${line}`;

    const crumbs = componentChain(selectedEl);
    crumbsNav.replaceChildren();
    crumbs.forEach((crumb, index) => {
      if (index) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '›';
        crumbsNav.appendChild(sep);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === crumbs.length - 1 ? 'crumb crumb--current' : 'crumb';
      button.textContent = crumb.name;
      button.addEventListener('click', () => select(crumb.el));
      crumbsNav.appendChild(button);
    });

    classesBox.replaceChildren();
    if (selectedEl.classList.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'classes-empty';
      empty.textContent = '(no classes)';
      classesBox.appendChild(empty);
    } else {
      for (const name of selectedEl.classList) {
        const chip = document.createElement('code');
        chip.className = 'class-chip';
        chip.textContent = name;
        classesBox.appendChild(chip);
      }
    }
    panel.hidden = false;
    renderStyles(selectedEl);
  }

  function span(className, text) {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  }

  // Cascade order of stylesheets, read from the DOM (Vite injects one
  // style[data-vite-dev-id] per imported CSS file, in load order). Files the
  // DOM doesn't know about fall back to the static scan order.
  function getSheetOrder(fileOrder) {
    const order = new Map(fileOrder.map((file, i) => [file, i]));
    document.querySelectorAll('style[data-vite-dev-id]').forEach((tag, i) => {
      const file = (tag.getAttribute('data-vite-dev-id') || '').split('?')[0];
      if (file.startsWith(`${projectRoot}/`)) {
        order.set(file.slice(projectRoot.length + 1), fileOrder.length + i);
      }
    });
    return order;
  }

  function tokenInfo(name, index, el, sheetOrder) {
    const defs = (index.tokens[name] || [])
      .map((def) => ({ ...def, order: sheetOrder.get(def.file) ?? 0 }))
      .sort((a, b) => a.order - b.order || a.line - b.line);
    const winner = defs[defs.length - 1];
    return {
      name,
      effective:
        getComputedStyle(el).getPropertyValue(name).trim() || (winner ? winner.value : ''),
      definedIn: winner ? `${winner.file}:${winner.line}` : '',
      conflicts: defs
        .slice(0, -1)
        .filter((def) => def.value !== winner.value)
        .map((def) => ({ value: def.value, location: `${def.file}:${def.line}` })),
    };
  }

  function tokenChainRow(name, index, el, sheetOrder) {
    const row = document.createElement('div');
    row.className = 'token-chain';
    const token = tokenInfo(name, index, el, sheetOrder);

    row.append(span('token-main', `${token.name} → ${token.effective || '(unresolved)'}`));
    if (token.definedIn) row.append(span('token-loc', ` · defined in ${token.definedIn}`));
    if (token.conflicts.length) {
      row.append(
        span(
          'conflict',
          `⚠ conflict — also ${token.conflicts
            .map((conflict) => `${conflict.value} in ${conflict.location}`)
            .join(', ')} (overridden by load order)`,
        ),
      );
    }
    return row;
  }

  function ruleCard(rule, index, el, sheetOrder) {
    const card = document.createElement('div');
    card.className = 'rule';

    const head = document.createElement('div');
    head.className = 'rule-head';
    const sel = document.createElement('code');
    sel.className = 'rule-sel';
    sel.textContent = rule.selector;
    const loc = document.createElement('a');
    loc.className = 'rule-loc';
    loc.textContent = `${rule.file}:${rule.line}`;
    loc.href = `vscode://file${projectRoot}/${rule.file}:${rule.line}`;
    head.append(sel, loc);
    card.append(head);

    for (const decl of rule.declarations) {
      const row = document.createElement('div');
      row.className = decl.overridden ? 'decl decl--overridden' : 'decl';
      const code = document.createElement('code');
      code.className = 'decl-code';
      code.textContent = `${decl.prop}: ${decl.value}${decl.important ? ' !important' : ''};`;
      row.append(code);
      const note = explainDeclaration(decl.prop, decl.value);
      if (note) row.append(span('decl-note', note));
      if (!decl.overridden) {
        for (const name of extractVarRefs(decl.value)) {
          row.append(tokenChainRow(name, index, el, sheetOrder));
        }
      }
      card.append(row);
    }
    return card;
  }

  let lastStyles = null; // { el, matched, index, sheetOrder } for the current selection

  async function loadStyles(el) {
    if (lastStyles && lastStyles.el === el) return lastStyles;
    const index = await (await fetch(CSS_INDEX_URL)).json();
    const sheetOrder = getSheetOrder(index.fileOrder);
    const matched = index.rules
      .filter((rule) => {
        try {
          return el.matches(rule.selector);
        } catch {
          return false;
        }
      })
      .map((rule) => ({ ...rule, sheetOrder: sheetOrder.get(rule.file) ?? 0 }));

    resolveCascade(matched);
    matched.sort((a, b) => b.sheetOrder - a.sheetOrder || b.line - a.line);
    return { el, matched, index, sheetOrder };
  }

  async function renderStyles(el) {
    stylesBox.replaceChildren(span('styles-empty', 'Resolving…'));
    let data;
    try {
      data = await loadStyles(el);
    } catch {
      stylesBox.replaceChildren(span('styles-empty', 'Could not load the CSS index.'));
      return;
    }
    if (el !== selectedEl) return; // selection changed while fetching
    lastStyles = data;

    stylesBox.replaceChildren();
    if (!data.matched.length) {
      stylesBox.append(span('styles-empty', 'No rules in src/ match this element.'));
      return;
    }
    for (const rule of data.matched) {
      stylesBox.append(ruleCard(rule, data.index, el, data.sheetOrder));
    }
  }

  async function onCopyContext() {
    const el = selectedEl;
    if (!el) return;

    let feedback = 'Copied ✓';
    try {
      const { matched, index, sheetOrder } = await loadStyles(el);
      const { file, line, component } = sourceInfo(el);
      const seen = new Set();
      const tokens = [];
      for (const rule of matched) {
        for (const decl of rule.declarations) {
          if (decl.overridden) continue;
          for (const name of extractVarRefs(decl.value)) {
            if (seen.has(name)) continue;
            seen.add(name);
            tokens.push(tokenInfo(name, index, el, sheetOrder));
          }
        }
      }
      const text = formatAiContext({
        component,
        source: `${file}:${line}`,
        breadcrumb: componentChain(el).map((crumb) => crumb.name),
        tag: el.tagName.toLowerCase(),
        classes: [...el.classList],
        rules: matched,
        tokens,
      });
      await navigator.clipboard.writeText(text);
    } catch {
      feedback = 'Copy failed';
    }
    const original = copyButton.textContent;
    copyButton.textContent = feedback;
    setTimeout(() => {
      copyButton.textContent = original;
    }, 1500);
  }

  function select(el) {
    selectedEl = el;
    lastStyles = null; // refetch so CSS edits are picked up on every selection
    renderPanel();
    scheduleRender();
  }

  function onMouseMove(event) {
    if (isOverlayEvent(event)) {
      if (hoverEl) {
        hoverEl = null;
        scheduleRender();
      }
      return;
    }
    const target =
      event.target instanceof Element ? event.target.closest(`[${SOURCE_ATTR}]`) : null;
    if (target !== hoverEl) {
      hoverEl = target;
      scheduleRender();
    }
  }

  function onClick(event) {
    if (isOverlayEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const target =
      event.target instanceof Element ? event.target.closest(`[${SOURCE_ATTR}]`) : null;
    if (target) select(target);
  }

  function onViewportChange() {
    scheduleRender();
  }

  function onKeyDown(event) {
    // e.code, not e.key: on macOS Option+I produces a dead key ("ˆ").
    // Meta/Ctrl excluded so Cmd+Option+I (browser DevTools) still works.
    if (
      event.altKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      event.code === 'KeyI' &&
      !event.repeat
    ) {
      event.preventDefault();
      setInspecting(!inspecting);
      return;
    }
    if (event.key === 'Escape' && inspecting) {
      event.preventDefault();
      setInspecting(false);
    }
  }

  function setInspecting(on) {
    if (on === inspecting) return;
    inspecting = on;
    if (on) {
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('click', onClick, true);
      window.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
      window.addEventListener('resize', onViewportChange);
      badge.hidden = false;
    } else {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onViewportChange, { capture: true });
      window.removeEventListener('resize', onViewportChange);
      hoverEl = null;
      selectedEl = null;
      badge.hidden = true;
      panel.hidden = true;
      hoverBox.hidden = true;
      selectedBox.hidden = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }
  }

  window.addEventListener('keydown', onKeyDown, true);
}
