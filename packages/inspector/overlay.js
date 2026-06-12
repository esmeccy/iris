// Browser-side DevLens overlay. The plugin serves this file as the virtual
// module /@devlens/overlay and appends an initDevlensOverlay({ root }) call
// with the project's absolute path. All overlay UI lives inside one Shadow
// DOM host so page styles and overlay styles never touch each other.

import {
  KIND_NOTES,
  classifyCrumb,
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

  .keycap {
    position: fixed;
    top: 18px;
    right: 18px;
    width: 46px;
    height: 46px;
    padding: 0;
    border: 0;
    border-radius: 11px;
    background: #f3f2f2ff;
    color: #5f6368;
    font: 500 21px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    box-shadow:
      0 0 0 5px #e4e5e7,
      0 1px 1px rgba(0, 0, 0, 0.04),
      0 6px 14px rgba(16, 24, 40, 0.10);
    opacity: 0.8;
    cursor: pointer;
    pointer-events: auto;
    user-select: none;
    touch-action: none;
    transition: opacity 0.15s ease;
  }
  .keycap:hover { opacity: 1; }
  .keycap--dragging { opacity: 1; cursor: grabbing; }
  .keycap--active {
    background: #ffffffff;
    color: #101010ff;
    box-shadow:
      0 0 0 5px #e4e5e7,
      inset 0 1px 3px rgba(161, 161, 161, 0.1);
    transform: translateY(1px);
    opacity: 1;
  }

  .keycap-tip {
    position: absolute;
    top: 50%;
    right: calc(100% + 14px);
    transform: translate(6px, -50%);
    padding: 4px 9px;
    border-radius: 6px;
    background: #1c2433;
    color: #fff;
    font: 400 11px/1.6 system-ui, sans-serif;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.15s ease, transform 0.15s ease;
    pointer-events: none;
  }
  .keycap:hover .keycap-tip { opacity: 1; transform: translate(0, -50%); }
  .keycap--tip-right .keycap-tip { right: auto; left: calc(100% + 14px); transform: translate(-6px, -50%); }
  .keycap--tip-right:hover .keycap-tip { transform: translate(0, -50%); }
  .keycap--dragging .keycap-tip { opacity: 0 !important; }

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

  .src-link {
    color: #667085;
    font-family: ui-monospace, Menlo, monospace;
    text-decoration: none;
    cursor: pointer;
  }
  .src-link::after { content: ' ↗'; font-size: 0.9em; opacity: 0; }
  .src-link:hover { color: #7c3aed; text-decoration: underline; }
  .src-link:hover::after { opacity: 1; }
  .panel-title .src-link { color: inherit; }
  .token-chain .src-link { color: inherit; }
  .conflict .src-link { color: inherit; font-family: inherit; }

  .crumbs { margin: 12px 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
  .crumb-wrap { position: relative; display: inline-flex; }
  .crumb { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 1px 3px; border-radius: 4px; color: #4f5b76; font: inherit; cursor: pointer; }
  .crumb:hover { background: #eef1f6; color: #1c2433; }
  .crumb--current { color: #7c3aed; font-weight: 600; }
  .crumb-sep { color: #98a2b3; }

  .crumb-kind {
    font-size: 8.5px;
    font-weight: 400;
    line-height: 1.5;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0 4px;
    border-radius: 999px;
    background: #eef1f6;
    border: 1px solid #e2e5ec;
    color: #667085;
  }
  .crumb-kind--page { background: #eff6ff; border-color: #dbeafe; color: #1d4ed8; }
  .crumb-kind--element { background: #fafafa; border-color: #efefef; color: #98a2b3; }
  .crumb--current .crumb-kind { background: #f3e8ff; border-color: #e9d5ff; color: #7c3aed; }
  .panel-title .crumb-kind { margin-left: 6px; vertical-align: 2px; }

  .crumb-tip {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 10;
    display: none;
    padding-top: 5px; /* hover bridge between crumb and tooltip */
  }
  .crumb-wrap:hover .crumb-tip { display: block; }
  .crumb-tip-inner {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 9px;
    border-radius: 6px;
    background: #1c2433;
    font: 11px/1.5 system-ui, sans-serif;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(16, 24, 40, 0.2);
  }
  .crumb-rel { color: #98a2b3; }
  .crumb-tip .src-link { color: #e4e7ec; font-size: 10.5px; }
  .crumb-tip .src-link:hover { color: #c4b5fd; }

  .panel-section h4 { margin: 12px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #667085; }
  .classes { display: flex; flex-wrap: wrap; gap: 4px; }
  .class-chip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #334155; background: #f2f4f7; border: 1px solid #e2e5ec; border-radius: 4px; padding: 1px 6px; }
  .class-chip.src-link:hover { border-color: #d6bbfb; background: #f9f5ff; }
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
  .decl-code { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #334155; text-decoration: none; }
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
    <button class="keycap" type="button" aria-label="Toggle inspect mode">I<span class="keycap-tip">Inspect — ⌥ + I</span></button>
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

  // --- Keycap entry button: click toggles inspect mode, drag repositions ---

  const keycap = shadow.querySelector('.keycap');
  const keycapTip = shadow.querySelector('.keycap-tip');
  const KEYCAP_POS_KEY = 'devlens-keycap-pos';
  const KEYCAP_SIZE = 46;
  const KEYCAP_MARGIN = 10; // keeps the 5px tray ring fully in view
  const DRAG_THRESHOLD = 4; // px of movement that turns a click into a drag

  function clampKeycapPos(x, y) {
    return {
      x: Math.min(Math.max(KEYCAP_MARGIN, x), window.innerWidth - KEYCAP_SIZE - KEYCAP_MARGIN),
      y: Math.min(Math.max(KEYCAP_MARGIN, y), window.innerHeight - KEYCAP_SIZE - KEYCAP_MARGIN),
    };
  }

  function applyKeycapPos(pos) {
    keycap.style.left = `${pos.x}px`;
    keycap.style.top = `${pos.y}px`;
    keycap.style.right = 'auto';
    // Near the left edge the slide-out tooltip would leave the viewport: flip it.
    keycap.classList.toggle('keycap--tip-right', pos.x < 140);
  }

  try {
    const saved = JSON.parse(localStorage.getItem(KEYCAP_POS_KEY));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      applyKeycapPos(clampKeycapPos(saved.x, saved.y));
    }
  } catch {
    /* corrupt/blocked storage: keep the default top-right position */
  }

  let keycapDrag = null;
  let suppressKeycapClick = false;

  keycap.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = keycap.getBoundingClientRect();
    keycapDrag = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    keycap.setPointerCapture(event.pointerId);
  });

  keycap.addEventListener('pointermove', (event) => {
    if (!keycapDrag) return;
    if (!keycapDrag.moved) {
      const distance = Math.hypot(
        event.clientX - keycapDrag.startX,
        event.clientY - keycapDrag.startY,
      );
      if (distance < DRAG_THRESHOLD) return;
      keycapDrag.moved = true;
      keycap.classList.add('keycap--dragging');
    }
    applyKeycapPos(
      clampKeycapPos(event.clientX - keycapDrag.offsetX, event.clientY - keycapDrag.offsetY),
    );
  });

  function endKeycapDrag() {
    if (!keycapDrag) return;
    if (keycapDrag.moved) {
      suppressKeycapClick = true; // the click event that follows a drag is not a toggle
      const rect = keycap.getBoundingClientRect();
      try {
        localStorage.setItem(KEYCAP_POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
      } catch {
        /* storage blocked: position just won't persist */
      }
    }
    keycap.classList.remove('keycap--dragging');
    keycapDrag = null;
  }

  keycap.addEventListener('pointerup', endKeycapDrag);
  keycap.addEventListener('pointercancel', endKeycapDrag);

  keycap.addEventListener('click', () => {
    if (suppressKeycapClick) {
      suppressKeycapClick = false;
      return;
    }
    setInspecting(!inspecting);
  });

  window.addEventListener('resize', () => {
    if (!keycap.style.left) return; // still at the default CSS position
    const rect = keycap.getBoundingClientRect();
    applyKeycapPos(clampKeycapPos(rect.left, rect.top));
  });

  function sourceInfo(el) {
    const source = el.getAttribute(SOURCE_ATTR) || '';
    const i = source.lastIndexOf(':');
    return {
      file: i > 0 ? source.slice(0, i) : source,
      line: i > 0 ? source.slice(i + 1) : '',
      // No component attribute on non-component stacks (plain HTML):
      // fall back to the element's own tag name.
      component: el.getAttribute(COMPONENT_ATTR) || el.tagName.toLowerCase(),
    };
  }

  // Builds the breadcrumb, context-first: component boundaries appear under
  // their component name, but every class-bearing element in between appears
  // under its primary class (hero, hero-title, card-body, …) — class names
  // carry the *meaning* of the structure, which is what designers navigate by.
  // A component boundary is the outermost element of a component subtree
  // (its parent belongs to a different component, or to none).
  function componentChain(el) {
    const chain = [];
    let outermostTagged = null;
    for (let cur = el; cur; cur = cur.parentElement) {
      if (!cur.hasAttribute(SOURCE_ATTR)) continue;
      outermostTagged = cur;
      const component = cur.getAttribute(COMPONENT_ATTR);
      const parentComponent = cur.parentElement?.getAttribute?.(COMPONENT_ATTR) ?? null;
      if (component && component !== parentComponent) {
        chain.push({ name: component, el: cur, isComponent: true });
      } else if (cur.classList.length) {
        chain.push({ name: cur.classList[0], el: cur, tag: cur.tagName.toLowerCase() });
      } else if (cur === el) {
        // The selection itself is always a crumb, classes or not.
        chain.push({ name: cur.tagName.toLowerCase(), el: cur, tag: cur.tagName.toLowerCase() });
      }
    }
    // Plain-HTML pages have no component to anchor the chain: anchor it with
    // the page file itself ("page is important, and it comes first").
    if (outermostTagged && !chain.some((crumb) => crumb.isComponent)) {
      const last = chain[chain.length - 1];
      if (last && last.el === outermostTagged) {
        last.isPageRoot = true;
      } else {
        const file = (outermostTagged.getAttribute(SOURCE_ATTR) || '').split(':')[0];
        chain.push({
          name: file.split('/').pop() || 'page',
          el: outermostTagged,
          isPageRoot: true,
        });
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
    // Rule A: the title and its location both open the defining file:line.
    const titleLink = srcLink(file, line);
    titleLink.textContent = `<${component}>`;
    panelTitle.replaceChildren(titleLink);
    panelLoc.replaceChildren(srcLink(file, line));
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

      const info = sourceInfo(crumb.el);
      const kind = crumb.isComponent
        ? classifyCrumb({ name: crumb.name, file: info.file, isComponent: true, isRoot: index === 0 })
        : crumb.isPageRoot
          ? 'page'
          : 'element';
      // Components/pages get the kind badge; structural class crumbs get
      // their tag (header, h1, div) — more telling than a generic "element".
      const makeBadge = () =>
        crumb.isComponent || crumb.isPageRoot ? kindBadge(kind) : tagBadge(crumb.tag);

      const wrap = document.createElement('span');
      wrap.className = 'crumb-wrap';

      // Click the crumb = re-target the inspector (existing behavior).
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === crumbs.length - 1 ? 'crumb crumb--current' : 'crumb';
      button.textContent = crumb.name;
      button.appendChild(makeBadge());
      button.addEventListener('click', () => select(crumb.el));

      // Hover = tooltip with relation + clickable file:line (Rule A).
      const relation =
        index === 0 ? `${kind} root` : `${kind} inside ${crumbs[index - 1].name}`;
      const tip = document.createElement('span');
      tip.className = 'crumb-tip';
      const tipInner = document.createElement('span');
      tipInner.className = 'crumb-tip-inner';
      tipInner.append(span('crumb-rel', relation), srcLink(info.file, info.line));
      tip.appendChild(tipInner);

      wrap.append(button, tip);
      crumbsNav.appendChild(wrap);

      // The last crumb describes the selection itself: badge the panel title.
      if (index === crumbs.length - 1) panelTitle.appendChild(makeBadge());
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

  // Rule A: every codebase-derived fact links to its exact source location.
  function srcLink(file, line) {
    const link = document.createElement('a');
    link.className = 'src-link';
    link.textContent = `${file}:${line}`;
    link.href = `vscode://file${projectRoot}/${file}:${line}`;
    return link;
  }

  function splitLoc(loc) {
    const i = loc.lastIndexOf(':');
    return [loc.slice(0, i), loc.slice(i + 1)];
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // page/component/element chip; hovering it teaches the word.
  function kindBadge(kind) {
    const chip = span(`crumb-kind crumb-kind--${kind}`, kind);
    chip.title = KIND_NOTES[kind] || '';
    return chip;
  }

  // Tag chip for class-named crumbs (hero → header): says what HTML the
  // class sits on; hover still teaches what an element is.
  function tagBadge(tag) {
    const chip = span('crumb-kind crumb-kind--element', tag);
    chip.title = KIND_NOTES.element;
    return chip;
  }

  // Cascade order of stylesheets, read from document.styleSheets so it covers
  // both Vite-injected style[data-vite-dev-id] tags (JS-imported CSS) and
  // plain <link rel="stylesheet"> tags, in true document order. Files the DOM
  // doesn't know about fall back to the static scan order.
  function getSheetOrder(fileOrder) {
    const order = new Map(fileOrder.map((file, i) => [file, i]));
    let position = fileOrder.length;
    for (const sheet of document.styleSheets) {
      let file = '';
      const viteDevId = sheet.ownerNode?.dataset?.viteDevId;
      if (viteDevId) {
        const id = viteDevId.split('?')[0];
        if (id.startsWith(`${projectRoot}/`)) file = id.slice(projectRoot.length + 1);
      } else if (sheet.href) {
        try {
          const url = new URL(sheet.href);
          if (url.origin === location.origin) file = url.pathname.replace(/^\//, '');
        } catch {
          /* cross-origin or unparsable: not ours */
        }
      }
      if (file) order.set(file, (position += 1));
    }
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

    const chainText = `${token.name} → ${token.effective || '(unresolved)'}`;
    if (token.definedIn) {
      // Rule A: the token itself and its definition site both open the editor.
      const [file, line] = splitLoc(token.definedIn);
      const main = srcLink(file, line);
      main.classList.add('token-main');
      main.textContent = chainText;
      row.append(main, span('token-loc', ' · defined in '), srcLink(file, line));
    } else {
      row.append(span('token-main', chainText));
    }

    if (token.conflicts.length) {
      const conflictEl = span('conflict', '⚠ conflict — also ');
      token.conflicts.forEach((conflict, i) => {
        if (i) conflictEl.append(', ');
        conflictEl.append(`${conflict.value} in `);
        const [file, line] = splitLoc(conflict.location);
        conflictEl.append(srcLink(file, line));
      });
      conflictEl.append(' (overridden by load order)');
      row.append(conflictEl);
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
    const loc = srcLink(rule.file, rule.line);
    loc.classList.add('rule-loc');
    head.append(sel, loc);
    card.append(head);

    for (const decl of rule.declarations) {
      const row = document.createElement('div');
      row.className = decl.overridden ? 'decl decl--overridden' : 'decl';
      // Rule A: each declaration opens the editor at its own line.
      const code = srcLink(rule.file, decl.line);
      code.classList.add('decl-code');
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

  // Rule A for class names: each chip links to the winning rule that targets
  // that class (data.matched is sorted winning-first). Classes nothing in
  // src/ targets stay plain chips.
  function renderClasses(el, data) {
    classesBox.replaceChildren();
    if (!el.classList.length) {
      classesBox.append(span('classes-empty', '(no classes)'));
      return;
    }
    for (const name of el.classList) {
      const pattern = new RegExp(`\\.${escapeRegex(name)}(?![\\w-])`);
      const rule = data?.matched.find((r) => pattern.test(r.selector));
      if (rule) {
        const chip = srcLink(rule.file, rule.line);
        chip.classList.add('class-chip');
        chip.textContent = name;
        chip.title = `${rule.selector} — ${rule.file}:${rule.line}`;
        classesBox.append(chip);
      } else {
        const chip = document.createElement('code');
        chip.className = 'class-chip';
        chip.textContent = name;
        chip.title = 'No rule in src/ targets this class';
        classesBox.append(chip);
      }
    }
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

    renderClasses(el, data);

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
    keycap.classList.toggle('keycap--active', on);
    keycapTip.textContent = on ? 'Exit — Esc' : 'Inspect — ⌥ + I';
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
