// Browser-side Iris overlay. The plugin serves this file as the virtual
// module /@iris/overlay and appends an initIrisOverlay({ root }) call
// with the project's absolute path. All overlay UI lives inside one Shadow
// DOM host so page styles and overlay styles never touch each other.

import {
  KIND_NOTES,
  classifyCrumb,
  explainDeclaration,
  extractVarRefs,
  formatAiContext,
  resolveCascade,
} from '/@iris/resolve';

const SOURCE_ATTR = 'data-iris-source';
const COMPONENT_ATTR = 'data-iris-component';
const CSS_INDEX_URL = '/@iris/css-index';

// Dark-theme token overrides, shared by the manual ([data-theme="dark"]) and
// automatic (prefers-color-scheme) paths so there is one source of truth.
const DARK = `
    --bg-grouped:#000000; --surface:#1C1C1E; --surface-2:#2C2C2E;
    --fill-1:rgba(120,120,128,0.24); --fill-2:rgba(120,120,128,0.16);
    --label:#FFFFFF; --label-2:rgba(235,235,245,0.62); --label-3:rgba(235,235,245,0.3);
    --separator:rgba(84,84,88,0.6); --separator-opaque:#38383A;
    --accent:#FFFFFF; --on-accent:#000000; --accent-soft:rgba(255,255,255,0.16);
    --win-text:#30D158; --win-bg:rgba(48,209,88,0.18);
    --danger-text:#FF6961; --danger-bg:rgba(255,69,58,0.18);
    --rl-margin:#FF9F0A; --rl-padding:#30D158; --rl-gap:#BF5AF2;
    --rl-margin-soft:rgba(255,159,10,0.22); --rl-padding-soft:rgba(48,209,88,0.22); --rl-gap-soft:rgba(191,90,242,0.22);
    --glass:rgba(44,44,46,0.72); --glass-border:rgba(255,255,255,0.12);
    --hover-solid:rgba(255,255,255,0.1); --hover-soft:rgba(255,255,255,0.06);
    --el-card:0 1px 2px rgba(0,0,0,0.4);
    --el-pop:0 10px 30px rgba(0,0,0,0.5);
    --el-panel:0 22px 54px -10px rgba(0,0,0,0.62), 0 6px 16px rgba(0,0,0,0.4);
`;

const STYLES = `
  /* --- Apple HIG v2 token foundation; graphite accent; light + dark --- */
  :host {
    --bg-grouped:#F2F2F7; --surface:#FFFFFF; --surface-2:#F2F2F7;
    --fill-1:rgba(120,120,128,0.12); --fill-2:rgba(120,120,128,0.08);
    --label:#1C1C1E; --label-2:rgba(60,60,67,0.62); --label-3:rgba(60,60,67,0.32);
    --separator:rgba(60,60,67,0.16); --separator-opaque:#D3D3D8;
    /* Graphite accent — near-black in light, white in dark. */
    --accent:#1C1C1E; --on-accent:#FFFFFF; --accent-soft:rgba(0,0,0,0.06);
    --win-text:#1E7A34; --win-bg:rgba(52,199,89,0.16);
    --danger-text:#C7362B; --danger-bg:rgba(255,59,48,0.13);
    /* The only saturated colours in the system — box model + structure. */
    --rl-margin:#FF9500; --rl-padding:#34C759; --rl-gap:#AF52DE;
    --rl-margin-soft:rgba(255,149,0,0.16); --rl-padding-soft:rgba(52,199,89,0.16); --rl-gap-soft:rgba(175,82,222,0.16);
    --glass:rgba(255,255,255,0.72); --glass-border:rgba(255,255,255,0.7);
    --hover-solid:rgba(0,0,0,0.06); --hover-soft:rgba(0,0,0,0.04);
    --r-xs:6px; --r-sm:8px; --r-md:12px; --r-lg:16px; --r-xl:20px; --r-2xl:28px; --r-full:980px;
    --el-card:0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.03);
    --el-pop:0 8px 28px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06);
    --el-panel:0 18px 48px -10px rgba(0,0,0,0.22), 0 6px 16px rgba(0,0,0,0.07);
    --mono:'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans:-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    --ease:cubic-bezier(0.25, 0.1, 0.25, 1);
    /* Thin-line icons, used as masks so they inherit currentColor. */
    --ic-arrow:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 17 17 7'/%3E%3Cpath d='M8 7h9v9'/%3E%3C/svg%3E");
    --ic-external:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 4h6v6'/%3E%3Cpath d='M20 4 11 13'/%3E%3Cpath d='M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'/%3E%3C/svg%3E");
    --ic-copy:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='11' height='11' rx='2.5'/%3E%3Cpath d='M5 15V5a2 2 0 0 1 2-2h10'/%3E%3C/svg%3E");
  }
  /* Manual dark override. */
  :host([data-theme="dark"]) {${DARK}  }
  /* Automatic: follow the host OS when no manual choice is set. */
  @media (prefers-color-scheme: dark) {
    :host([data-theme="auto"]) {${DARK}  }
  }

  @media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }

  * { box-sizing: border-box; }

  .box {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
  }
  .box--hover {
    border: 1.5px solid var(--accent);
    background: var(--accent-soft);
  }
  .box--selected {
    border: 2px solid var(--accent);
  }

  /* Component-name label — a frosted-glass chip, like floating chrome. */
  .label {
    position: absolute;
    left: -1.5px;
    bottom: 100%;
    margin-bottom: 5px;
    padding: 3px 9px;
    border-radius: var(--r-sm);
    background: var(--glass);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--glass-border);
    color: var(--label);
    font: 11px/1.6 var(--mono);
    white-space: nowrap;
    box-shadow: var(--el-pop);
  }
  .label--below {
    bottom: auto;
    top: 100%;
    margin: 5px 0 0;
  }

  /* Entry keycap — a frosted-glass squircle (floating chrome). */
  .keycap {
    position: fixed;
    top: 18px;
    right: 18px;
    width: 48px;
    height: 48px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--separator);
    border-radius: 15px;
    background: var(--glass);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    box-shadow: var(--el-pop);
    cursor: pointer;
    pointer-events: auto;
    user-select: none;
    touch-action: none;
    transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease), background 0.2s var(--ease);
  }
  .keycap-i {
    color: var(--label);
    font: 600 22px/1 var(--mono);
  }
  .keycap:hover { box-shadow: var(--el-panel); }
  .keycap:active { transform: scale(0.96); }
  .keycap--dragging {
    cursor: grabbing;
    box-shadow: var(--el-panel);
    transform: rotate(-4deg) scale(1.05);
  }
  .keycap--active {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft), var(--el-pop);
  }
  .keycap--active .keycap-i { color: var(--on-accent); }

  .keycap-tip {
    position: absolute;
    top: 50%;
    right: calc(100% + 14px);
    transform: translate(6px, -50%);
    padding: 6px 11px;
    border-radius: var(--r-sm);
    background: var(--glass);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--glass-border);
    color: var(--label);
    font: 400 11px/1.6 var(--sans);
    white-space: nowrap;
    box-shadow: var(--el-pop);
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
    /* Column layout: a static header bar + a scrolling body. The header (and
       its close button) therefore never scroll away or sit under a scrollbar. */
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--separator);
    border-radius: var(--r-xl);
    background: var(--surface);
    color: var(--label);
    font: 13px/1.5 var(--sans);
    box-shadow: var(--el-panel);
    pointer-events: auto;
  }
  /* display:flex above overrides the [hidden] attribute's UA display:none,
     so restore it explicitly — otherwise the panel shows when it shouldn't
     and the close button can't hide it. */
  .panel[hidden] { display: none; }

  .panel-body {
    flex: 1 1 auto;
    overflow: auto;
    padding: 12px 14px 14px;
  }
  .panel-body > :first-child { margin-top: 0; }

  .panel-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px 10px 14px;
    border-bottom: 1px solid var(--separator);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
  }
  .panel-drag {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: none;
    padding: 4px;
    color: var(--label-3);
    line-height: 0;
    cursor: grab;
    touch-action: none;
    border-radius: var(--r-xs);
  }
  .panel-drag:hover { color: var(--label-2); }
  .panel--dragging .panel-drag { cursor: grabbing; }
  /* Headings take the remaining space and ellipsize so they can never push the
     close button off the edge. */
  .panel-headings { flex: 1 1 auto; min-width: 0; }
  .panel-title { font-weight: 600; font-size: 16px; font-family: var(--mono); color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .panel-loc { color: var(--label-2); font-family: var(--mono); font-size: 11.5px; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .panel-close {
    flex: 0 0 auto; width: 34px; height: 34px; border: 0; background: var(--fill-1);
    color: var(--label-2); cursor: pointer; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s var(--ease), color 0.15s var(--ease);
  }
  .panel-close:hover { box-shadow: inset 0 0 0 999px var(--hover-soft); color: var(--label); }

  /* Every fact links to source — the recurring bridge from pixel to code. */
  .src-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--accent);
    font-family: var(--mono);
    text-decoration: none;
    cursor: pointer;
  }
  .src-link::after {
    content: '';
    width: 0.8em; height: 0.8em;
    background: currentColor;
    -webkit-mask: var(--ic-arrow) center / contain no-repeat;
    mask: var(--ic-arrow) center / contain no-repeat;
    opacity: 0;
    transition: opacity 0.15s var(--ease);
  }
  .src-link:hover { text-decoration: underline; }
  .src-link:hover::after { opacity: 0.85; }
  .panel-title .src-link { color: inherit; }
  .token-chain .src-link { color: inherit; }
  .conflict .src-link { color: inherit; font-family: inherit; }

  .crumbs { margin: 12px 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
  .crumbs[hidden] { display: none; } /* display:flex would otherwise defeat the collapse */
  .crumb-wrap { position: relative; display: inline-flex; }
  .crumb { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 1px 3px; border-radius: var(--r-xs); color: var(--label-2); font: inherit; cursor: pointer; }
  .crumb:hover { box-shadow: inset 0 0 0 999px var(--hover-soft); color: var(--label); }
  .crumb--current { color: var(--accent); font-weight: 600; }
  .crumb-sep { color: var(--label-3); }

  .crumb-kind {
    font-size: 8.5px;
    font-weight: 500;
    line-height: 1.6;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0 5px;
    border-radius: var(--r-full);
    background: var(--fill-1);
    color: var(--label-2);
  }
  .crumb-kind--page { background: var(--accent-soft); color: var(--accent); }
  .crumb-kind--element { background: var(--fill-1); color: var(--label-2); }
  .crumb--current .crumb-kind { background: var(--accent-soft); color: var(--accent); }
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
    padding: 7px 10px;
    border-radius: var(--r-sm);
    background: var(--glass);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--glass-border);
    color: var(--label);
    font: 11px/1.5 var(--sans);
    white-space: nowrap;
    box-shadow: var(--el-pop);
  }
  .crumb-rel { color: var(--label-2); }
  .crumb-tip .src-link { color: var(--accent); font-size: 10.5px; }
  .crumb-tip .src-link:hover { text-decoration: underline; }

  .panel-section h4 { margin: 16px 0 10px; font-size: 13px; font-weight: 600; letter-spacing: 0; text-transform: none; font-family: var(--sans); color: var(--label-2); }
  .classes { display: flex; flex-wrap: wrap; gap: 5px; }
  .class-chip { font-family: var(--mono); font-size: 11px; color: var(--label); background: var(--fill-1); border: 0; border-radius: var(--r-full); padding: 3px 10px; }
  .class-chip.src-link { gap: 4px; }
  .class-chip.src-link:hover { box-shadow: inset 0 0 0 999px var(--hover-soft); }
  .classes-empty { color: var(--label-2); }

  .actions { display: flex; gap: 8px; margin-top: 16px; }
  .vscode {
    display: inline-flex; align-items: center; gap: 8px;
    height: 40px; padding: 0 18px; border-radius: var(--r-md);
    background: var(--accent); color: var(--on-accent);
    text-decoration: none; font: 600 14px var(--sans); cursor: pointer;
    transition: box-shadow 0.15s var(--ease), transform 0.1s var(--ease);
  }
  .vscode::before {
    content: ''; width: 17px; height: 17px; flex: none;
    background: currentColor;
    -webkit-mask: var(--ic-external) center / contain no-repeat;
    mask: var(--ic-external) center / contain no-repeat;
  }
  .vscode:hover { box-shadow: inset 0 0 0 999px var(--hover-solid); }
  .vscode:active { transform: scale(0.98); }
  .copy-context {
    display: inline-flex; align-items: center; gap: 8px;
    height: 40px; padding: 0 18px; border-radius: var(--r-md);
    border: 0; background: var(--fill-1); color: var(--label);
    font: 600 14px var(--sans); cursor: pointer;
    transition: box-shadow 0.15s var(--ease), transform 0.1s var(--ease);
  }
  .copy-context::before {
    content: ''; width: 17px; height: 17px; flex: none;
    background: currentColor;
    -webkit-mask: var(--ic-copy) center / contain no-repeat;
    mask: var(--ic-copy) center / contain no-repeat;
  }
  .copy-context:hover { box-shadow: inset 0 0 0 999px var(--hover-soft); }
  .copy-context:active { transform: scale(0.98); }

  .rule { margin-bottom: 12px; border: 1px solid var(--separator); border-radius: var(--r-md); background: var(--surface-2); overflow: hidden; }
  .rule-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 13px; border-bottom: 1px solid var(--separator); }
  .rule-sel { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--label); }
  .rule-loc { font-family: var(--mono); font-size: 11px; color: var(--label-2); text-decoration: none; white-space: nowrap; }
  .rule-loc:hover { text-decoration: underline; }

  .decl { margin: 3px 0; padding: 0 13px; }
  .rule-head + .decl { margin-top: 9px; }
  .decl:last-child { margin-bottom: 9px; }
  .decl-code { font-family: var(--mono); font-size: 12px; color: var(--label); text-decoration: none; }
  .decl-code .src-link, .decl-code.src-link { color: var(--label); }
  .decl--overridden .decl-code { text-decoration: line-through; color: var(--label-3); }
  .cascade-badge {
    display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: var(--r-xs);
    font: 600 10px var(--mono); line-height: 1.5; vertical-align: 1px; white-space: nowrap;
  }
  .cascade-badge--win { background: var(--win-bg); color: var(--win-text); }
  .cascade-badge--lose { background: var(--danger-bg); color: var(--danger-text); }

  .note-card {
    position: fixed;
    z-index: 20;
    max-width: 320px;
    padding: 12px 14px;
    border: 1px solid var(--glass-border);
    border-radius: var(--r-lg);
    background: var(--glass);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    box-shadow: var(--el-pop);
    font: 11.5px/1.5 var(--sans);
    color: var(--label-2);
    pointer-events: auto;
  }
  .note-card--pinned {
    position: static;
    width: 100%;
    max-width: none;
    margin: 4px 0 6px;
    background: var(--surface-2);
    border-color: var(--separator);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    box-shadow: none;
  }
  .note-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .note-text { color: var(--label); }
  .note-pin {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border: 0; border-radius: 50%;
    background: none; color: var(--label-3); cursor: pointer; line-height: 0;
    transition: background 0.15s var(--ease), color 0.15s var(--ease);
  }
  .note-pin:hover { background: var(--hover-soft); color: var(--label-2); }
  .note-pin--on { color: var(--accent); }
  .note-pin svg { width: 15px; height: 15px; }
  .note-card .token-chain { margin: 4px 0 0 12px; }

  .token-chain { margin: 1px 0 3px 12px; font-family: var(--mono); font-size: 10.5px; color: var(--label-2); }
  .token-loc { color: var(--label-2); }
  .conflict { display: block; color: var(--danger-text); font-family: var(--sans); font-size: 11px; }
  .styles-empty { color: var(--label-2); }

  .structure-layer { position: fixed; top: 0; left: 0; pointer-events: none; }
  .sbox { position: fixed; top: 0; left: 0; pointer-events: none; }
  .sbox--margin { background: rgba(255, 149, 0, 0.24); }
  .sbox--padding { background: rgba(52, 199, 89, 0.26); }
  .sbox--content { border: 1px solid var(--accent); }
  .sbox--parent { border: 1.5px dashed var(--label-3); }
  .sbox--sibling { border: 1px dotted var(--label-3); opacity: 0.7; }
  .sbox--gap { background: rgba(175, 82, 222, 0.20); }
  .slabel {
    position: fixed;
    top: 0;
    left: 0;
    padding: 2px 7px;
    border-radius: var(--r-xs);
    background: var(--glass);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--glass-border);
    color: var(--label);
    font: 500 10px/1.5 var(--mono);
    white-space: nowrap;
    box-shadow: var(--el-card);
  }
  .slabel--margin { background: #E08600; border-color: transparent; color: #fff; }
  .slabel--padding { background: #248A3D; border-color: transparent; color: #fff; }
  .slabel--gap { background: #8E44C4; border-color: transparent; color: #fff; }

  /* Structure: HIG filter pills */
  .structure-toggle {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 2px;
    user-select: none;
  }
  .structure-label { font: 600 13px var(--sans); color: var(--label-2); margin-right: 2px; }
  .schip {
    display: inline-flex; align-items: center; gap: 7px;
    height: 32px; padding: 0 14px;
    border: 0; border-radius: var(--r-full);
    background: var(--fill-1); color: var(--label-2);
    font: 500 13px var(--sans); cursor: pointer;
    transition: background 0.15s var(--ease), color 0.15s var(--ease);
  }
  .schip:hover { box-shadow: inset 0 0 0 999px var(--hover-soft); }
  .schip--on { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  .schip--muted { opacity: 0.4; }
  .schip .dot { opacity: 0.4; }
  .schip--on .dot { opacity: 1; }
  .dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
  .dot--margin { background: var(--rl-margin); }
  .dot--padding { background: var(--rl-padding); }
  .dot--gap { background: var(--rl-gap); }

  /* Item 3: collapsible breadcrumb */
  .crumbs-wrap { margin: 10px 0 2px; }
  .crumbs-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    border: 0; background: none; padding: 2px 3px; border-radius: var(--r-xs);
    color: var(--label-2); font: inherit; cursor: pointer; max-width: 100%;
  }
  .crumbs-toggle:hover { box-shadow: inset 0 0 0 999px var(--hover-soft); color: var(--label); }
  .crumbs-caret { display: inline-flex; color: var(--label-3); line-height: 0; transition: transform 0.2s var(--ease); }
  .crumbs-toggle[aria-expanded="true"] .crumbs-caret { transform: rotate(90deg); }
  .crumbs-summary { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Theme: segmented Auto · Light · Dark */
  .theme-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; }
  .theme-label { font: 600 13px var(--sans); color: var(--label-2); }
  .theme-seg { display: inline-flex; gap: 2px; background: var(--fill-1); border-radius: 10px; padding: 2px; }
  .theme-opt {
    display: inline-flex; align-items: center; gap: 6px;
    border: 0; background: transparent; color: var(--label-2);
    border-radius: 8px; padding: 6px 11px; font: 500 12px var(--sans); cursor: pointer; line-height: 1;
    transition: color 0.15s var(--ease);
  }
  .theme-opt svg { width: 14px; height: 14px; }
  .theme-opt:hover { color: var(--label); }
  .theme-opt--on { background: var(--surface); color: var(--label); font-weight: 600; box-shadow: var(--el-card); }

  /* Item 1: editor picker */
  .editor-row { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
  .editor-label {
    display: inline-flex; align-items: center; gap: 6px;
    font: 600 13px var(--sans); color: var(--label-2);
  }
  .editor-pick {
    font: 13px var(--sans); color: var(--label);
    padding: 8px 10px; border-radius: var(--r-sm); border: 1px solid var(--separator); background: var(--surface-2);
    text-transform: none; letter-spacing: 0;
  }
  .editor-template {
    font: 12px var(--mono); color: var(--label);
    padding: 8px 10px; border-radius: var(--r-sm); border: 1px solid var(--separator); background: var(--surface-2);
  }

  /* Item 4: highlight declarations that drive an active structure annotation,
     color-matched to that type's redline color. */
  .decl--hl { border-radius: var(--r-xs); }
  .decl--hl[data-sgroup="margin"] { background: var(--rl-margin-soft); box-shadow: inset 2px 0 0 var(--rl-margin); }
  .decl--hl[data-sgroup="padding"] { background: var(--rl-padding-soft); box-shadow: inset 2px 0 0 var(--rl-padding); }
  .decl--hl[data-sgroup="gap"] { background: var(--rl-gap-soft); box-shadow: inset 2px 0 0 var(--rl-gap); }

  /* Focus rings (accessibility) — visible on light, dark and graphite. */
  .keycap:focus-visible, .panel-close:focus-visible, .panel-drag:focus-visible,
  .schip:focus-visible, .vscode:focus-visible, .copy-context:focus-visible,
  .crumb:focus-visible, .crumbs-toggle:focus-visible, .src-link:focus-visible,
  .editor-pick:focus-visible, .note-pin:focus-visible, .theme-opt:focus-visible {
    outline: none; box-shadow: 0 0 0 4px var(--accent-soft), 0 0 0 1px var(--accent);
  }
`;

// Thin-line pin glyph for the annotation pin/unpin control.
const PIN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l-1 7 3 2.5v1.2H7v-1.2L10 11 9 4Z"/><path d="M12 15.7V21"/></svg>';

// Editor jump targets. Templates use {root} {file} {line} {col} placeholders.
// All are VS Code-family schemes. The trailing :{line}:{col} is required for
// these editors to actually move the cursor to (and highlight) the line — with
// only :{line} many builds open the file but don't navigate to it.
// Antigravity IDE registers 'antigravity-ide' (its product.json urlProtocol) —
// distinct from the 'antigravity' companion app.
const EDITORS = {
  vscode: { label: 'VS Code', template: 'vscode://file{root}/{file}:{line}:{col}' },
  cursor: { label: 'Cursor', template: 'cursor://file{root}/{file}:{line}:{col}' },
  antigravity: { label: 'Antigravity IDE', template: 'antigravity-ide://file{root}/{file}:{line}:{col}' },
  custom: { label: 'Custom', template: '' },
};

// localStorage can throw (private mode, sandboxed iframes); never let the
// overlay break over a preference read/write.
function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function initIrisOverlay(config) {
  if (window.__irisOverlay) return;
  window.__irisOverlay = true;

  const projectRoot = String(config.root || '').replace(/\/+$/, '');

  let inspecting = false;
  let hoverEl = null;
  let selectedEl = null;
  // Active structure annotation types. Empty = nothing drawn (was structureOn).
  const structureTypes = readStructureTypes();
  let rafId = 0;

  // --- Item 1: editor jump target (runtime-switchable, persisted) ----------
  const EDITOR_KEY = 'iris:editor';
  const EDITOR_TEMPLATE_KEY = 'iris:editor-custom-template';

  let editorId = lsGet(EDITOR_KEY) || config.editor || 'vscode';
  if (!EDITORS[editorId]) editorId = 'vscode';
  let customTemplate =
    lsGet(EDITOR_TEMPLATE_KEY) || (config.editorTemplate || '');

  function editorUrl(file, line) {
    const template =
      editorId === 'custom'
        ? customTemplate || EDITORS.vscode.template
        : EDITORS[editorId].template;
    return template
      .replaceAll('{root}', projectRoot)
      .replaceAll('{file}', file)
      .replaceAll('{line}', String(line))
      .replaceAll('{col}', '1');
  }

  function readStructureTypes() {
    const stored = lsGet('iris:structure-types');
    // First run defaults to all; an explicit empty choice is preserved ('').
    if (stored == null) return new Set(['margin', 'padding', 'gap']);
    return new Set(stored.split(',').filter(Boolean));
  }
  function saveStructureTypes() {
    lsSet('iris:structure-types', [...structureTypes].join(','));
  }

  // --- Theme: auto (follows the OS) or a persisted manual override ---------
  const THEME_KEY = 'iris:theme';
  const THEMES = ['auto', 'light', 'dark'];
  let themeChoice = lsGet(THEME_KEY) || 'auto';
  if (!THEMES.includes(themeChoice)) themeChoice = 'auto';

  const host = document.createElement('div');
  host.setAttribute('data-iris-overlay', '');
  host.setAttribute('data-theme', themeChoice);
  host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${STYLES}</style>
    <div class="structure-layer"></div>
    <div class="box box--hover" hidden><span class="label"></span></div>
    <div class="box box--selected" hidden></div>
    <button class="keycap" type="button" aria-label="Toggle inspect mode"><span class="keycap-i">I</span><span class="keycap-tip">Inspect — ⌥ + I</span></button>
    <aside class="panel" hidden>
      <header class="panel-head">
        <button class="panel-drag" type="button" title="Drag to move the panel" aria-label="Drag to move the panel"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg></button>
        <div class="panel-headings">
          <div class="panel-title"></div>
          <div class="panel-loc"></div>
        </div>
        <button class="panel-close" type="button" title="Clear selection" aria-label="Clear selection"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </header>
      <div class="panel-body">
      <div class="crumbs-wrap">
        <button class="crumbs-toggle" type="button" aria-expanded="false" title="Show breadcrumb path">
          <span class="crumbs-caret"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>
          <span class="crumbs-summary"></span>
        </button>
        <nav class="crumbs" hidden></nav>
      </div>
      <div class="structure-toggle">
        <span class="structure-label">Structure</span>
        <button type="button" class="schip schip--all" data-all aria-pressed="false">all</button>
        <button type="button" class="schip" data-type="margin" aria-pressed="false"><i class="dot dot--margin"></i>margin</button>
        <button type="button" class="schip" data-type="padding" aria-pressed="false"><i class="dot dot--padding"></i>padding</button>
        <button type="button" class="schip" data-type="gap" aria-pressed="false"><i class="dot dot--gap"></i>gap</button>
      </div>
      <section class="panel-section">
        <h4>Classes</h4>
        <div class="classes"></div>
      </section>
      <section class="panel-section">
        <h4>Styles</h4>
        <div class="styles"></div>
      </section>
      <div class="editor-row">
        <label class="editor-label">Open in
          <select class="editor-pick">
            <option value="vscode">VS Code</option>
            <option value="cursor">Cursor</option>
            <option value="antigravity">Antigravity IDE</option>
            <option value="custom">Custom…</option>
          </select>
        </label>
        <input class="editor-template" type="text" spellcheck="false"
          placeholder="myeditor://open?file={root}/{file}&line={line}&col={col}" hidden />
      </div>
      <div class="theme-row">
        <span class="theme-label">Theme</span>
        <div class="theme-seg" role="group" aria-label="Theme">
          <button type="button" class="theme-opt" data-theme-opt="auto" title="Match the system appearance"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>Auto</button>
          <button type="button" class="theme-opt" data-theme-opt="light" title="Always light"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.6 12h2.2M19.2 12h2.2M6.1 17.9l-1.5 1.5M19.4 4.6l-1.5 1.5"/></svg>Light</button>
          <button type="button" class="theme-opt" data-theme-opt="dark" title="Always dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 13.2A8.4 8.4 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7Z"/></svg>Dark</button>
        </div>
      </div>
      <div class="actions">
        <a class="vscode" href="#">Open in editor</a>
        <button class="copy-context" type="button">Copy AI context</button>
      </div>
      </div>
    </aside>
  `;
  document.body.appendChild(host);

  const structureLayer = shadow.querySelector('.structure-layer');
  const structureChips = [...shadow.querySelectorAll('.schip[data-type]')];
  const structureAllChip = shadow.querySelector('.schip[data-all]');
  const crumbsWrap = shadow.querySelector('.crumbs-wrap');
  const crumbsToggle = shadow.querySelector('.crumbs-toggle');
  const crumbsCaret = shadow.querySelector('.crumbs-caret');
  const crumbsSummary = shadow.querySelector('.crumbs-summary');
  const editorPick = shadow.querySelector('.editor-pick');
  const editorTemplateInput = shadow.querySelector('.editor-template');
  const hoverBox = shadow.querySelector('.box--hover');
  const hoverLabel = shadow.querySelector('.label');
  const selectedBox = shadow.querySelector('.box--selected');
  const panel = shadow.querySelector('.panel');
  const panelDragHandle = shadow.querySelector('.panel-drag');
  const panelTitle = shadow.querySelector('.panel-title');
  const panelLoc = shadow.querySelector('.panel-loc');
  const crumbsNav = shadow.querySelector('.crumbs');
  const classesBox = shadow.querySelector('.classes');
  const stylesBox = shadow.querySelector('.styles');
  const vscodeLink = shadow.querySelector('.vscode');
  const copyButton = shadow.querySelector('.copy-context');
  const themeOpts = [...shadow.querySelectorAll('.theme-opt')];

  copyButton.addEventListener('click', onCopyContext);

  // Theme toggle: write the choice to the host attribute (CSS does the rest)
  // and persist it. 'auto' lets the prefers-color-scheme media query decide.
  function applyTheme() {
    host.setAttribute('data-theme', themeChoice);
    for (const opt of themeOpts) {
      const on = opt.dataset.themeOpt === themeChoice;
      opt.classList.toggle('theme-opt--on', on);
      opt.setAttribute('aria-pressed', String(on));
    }
  }
  for (const opt of themeOpts) {
    opt.addEventListener('click', () => {
      themeChoice = opt.dataset.themeOpt;
      lsSet(THEME_KEY, themeChoice);
      applyTheme();
    });
  }
  applyTheme();

  shadow.querySelector('.panel-close').addEventListener('click', () => {
    selectedEl = null;
    renderPanel();
    scheduleRender();
  });

  // --- Rule B: annotations hidden until hover, pinnable per row -----------
  // One floating card serves all rows: hovering a row with annotation data
  // shows it (floated, so nothing shifts); pinning embeds a copy inline under
  // the row. Pins reset naturally on re-selection (the rows are rebuilt).

  const noteCard = document.createElement('div');
  noteCard.className = 'note-card';
  noteCard.hidden = true;
  shadow.appendChild(noteCard);

  const rowNoteData = new WeakMap(); // row element -> { note, extras() }
  const pinnedRows = new WeakMap(); // row element -> pinned inline card
  let noteHideTimer = 0;
  let noteAnchorRow = null;

  function buildNoteContent(data, row, pinned) {
    const frag = document.createDocumentFragment();
    const head = document.createElement('div');
    head.className = 'note-head';
    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = pinned ? 'note-pin note-pin--on' : 'note-pin';
    pinButton.innerHTML = PIN_SVG;
    pinButton.setAttribute('aria-label', pinned ? 'Unpin explanation' : 'Pin explanation');
    pinButton.title = pinned ? 'Hide this explanation again' : 'Keep this explanation visible';
    pinButton.addEventListener('click', () => togglePin(row));
    head.append(span('note-text', data.note), pinButton);
    frag.append(head);
    for (const extra of data.extras ? data.extras() : []) frag.append(extra);
    return frag;
  }

  function showNoteCard(row) {
    if (pinnedRows.has(row)) return; // already embedded inline
    const data = rowNoteData.get(row);
    if (!data) return;
    clearTimeout(noteHideTimer);
    if (noteAnchorRow === row && !noteCard.hidden) return;
    noteAnchorRow = row;
    noteCard.replaceChildren(buildNoteContent(data, row, false));
    noteCard.hidden = false;
    const rect = row.getBoundingClientRect();
    noteCard.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 330))}px`;
    noteCard.style.top = `${rect.bottom + 4}px`;
    const cardHeight = noteCard.getBoundingClientRect().height;
    if (rect.bottom + 4 + cardHeight > window.innerHeight - 8) {
      noteCard.style.top = `${rect.top - cardHeight - 4}px`;
    }
  }

  function hideNoteCard() {
    noteCard.hidden = true;
    noteAnchorRow = null;
  }

  function scheduleNoteHide() {
    clearTimeout(noteHideTimer);
    noteHideTimer = setTimeout(hideNoteCard, 150); // delay prevents flicker
  }

  function togglePin(row) {
    const existing = pinnedRows.get(row);
    if (existing) {
      existing.remove();
      pinnedRows.delete(row);
      return;
    }
    const data = rowNoteData.get(row);
    if (!data) return;
    const card = document.createElement('div');
    card.className = 'note-card note-card--pinned';
    card.append(buildNoteContent(data, row, true));
    row.insertAdjacentElement('afterend', card);
    pinnedRows.set(row, card);
    hideNoteCard();
  }

  panel.addEventListener('mouseover', (event) => {
    const row = event.target.closest?.('.decl, .class-chip');
    if (row) showNoteCard(row);
  });
  panel.addEventListener('mouseout', (event) => {
    const row = event.target.closest?.('.decl, .class-chip');
    if (row && row === noteAnchorRow) scheduleNoteHide();
  });
  noteCard.addEventListener('mouseenter', () => clearTimeout(noteHideTimer));
  noteCard.addEventListener('mouseleave', scheduleNoteHide);
  panel.addEventListener('scroll', hideNoteCard);

  // --- Keycap entry button: click toggles inspect mode, drag repositions ---

  const keycap = shadow.querySelector('.keycap');
  const keycapTip = shadow.querySelector('.keycap-tip');
  const KEYCAP_POS_KEY = 'iris-keycap-pos';
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

  // The inspector panel can be dragged by its header so it never permanently
  // covers the element being inspected. Same click-vs-drag threshold as the
  // keycap: a quick click on the title/location link still opens the editor.
  const PANEL_POS_KEY = 'iris:panel-pos';
  const PANEL_MARGIN = 8;

  function clampPanelPos(x, y) {
    const w = panel.offsetWidth || 380;
    return {
      x: Math.min(Math.max(PANEL_MARGIN, x), Math.max(PANEL_MARGIN, window.innerWidth - w - PANEL_MARGIN)),
      // Keep the header on screen even if the panel is taller than the viewport.
      y: Math.min(Math.max(PANEL_MARGIN, y), window.innerHeight - 44),
    };
  }

  function applyPanelPos(pos) {
    panel.style.left = `${pos.x}px`;
    panel.style.top = `${pos.y}px`;
    panel.style.right = 'auto';
  }

  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_POS_KEY));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      applyPanelPos(clampPanelPos(saved.x, saved.y));
    }
  } catch {
    /* corrupt/blocked storage: keep the default top-right position */
  }

  let panelDrag = null;

  panelDragHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    panelDrag = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    panel.classList.add('panel--dragging');
    panelDragHandle.setPointerCapture(event.pointerId);
  });

  panelDragHandle.addEventListener('pointermove', (event) => {
    if (!panelDrag) return;
    applyPanelPos(
      clampPanelPos(event.clientX - panelDrag.offsetX, event.clientY - panelDrag.offsetY),
    );
  });

  function endPanelDrag() {
    if (!panelDrag) return;
    const rect = panel.getBoundingClientRect();
    try {
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
    } catch {
      /* storage blocked: position just won't persist */
    }
    panel.classList.remove('panel--dragging');
    panelDrag = null;
  }

  panelDragHandle.addEventListener('pointerup', endPanelDrag);
  panelDragHandle.addEventListener('pointercancel', endPanelDrag);

  // Item 4: per-type structure filter chips. Each drives one annotation kind
  // and highlights the matching declaration rows. "all" toggles every type.
  function syncStructureUI() {
    for (const chip of structureChips) {
      const on = structureTypes.has(chip.dataset.type);
      chip.classList.toggle('schip--on', on);
      chip.setAttribute('aria-pressed', String(on));
    }
    const all = structureTypes.size === structureChips.length;
    structureAllChip.classList.toggle('schip--on', all);
    structureAllChip.setAttribute('aria-pressed', String(all));
  }
  for (const chip of structureChips) {
    chip.addEventListener('click', () => {
      const type = chip.dataset.type;
      if (structureTypes.has(type)) structureTypes.delete(type);
      else structureTypes.add(type);
      saveStructureTypes();
      syncStructureUI();
      applyStructureHighlight();
      scheduleRender();
    });
  }
  structureAllChip.addEventListener('click', () => {
    const turnOn = structureTypes.size !== structureChips.length;
    structureTypes.clear();
    if (turnOn) for (const chip of structureChips) structureTypes.add(chip.dataset.type);
    saveStructureTypes();
    syncStructureUI();
    applyStructureHighlight();
    scheduleRender();
  });
  syncStructureUI();

  // Item 3: breadcrumb collapsed by default, expand on click (persisted).
  let crumbsExpanded = lsGet('iris:crumbs-expanded') === '1';
  function applyCrumbsExpanded() {
    crumbsNav.hidden = !crumbsExpanded;
    crumbsToggle.setAttribute('aria-expanded', String(crumbsExpanded));
    // The caret is an SVG chevron; CSS rotates it from aria-expanded.
  }
  crumbsToggle.addEventListener('click', () => {
    crumbsExpanded = !crumbsExpanded;
    lsSet('iris:crumbs-expanded', crumbsExpanded ? '1' : '0');
    applyCrumbsExpanded();
  });
  applyCrumbsExpanded();

  // Item 1: editor picker. Switching re-renders so existing links pick up the
  // new scheme.
  editorPick.value = editorId;
  editorTemplateInput.value = customTemplate;
  editorTemplateInput.hidden = editorId !== 'custom';
  refreshEditorLinks();
  editorPick.addEventListener('change', () => {
    editorId = editorPick.value;
    lsSet(EDITOR_KEY, editorId);
    editorTemplateInput.hidden = editorId !== 'custom';
    refreshEditorLinks();
  });
  editorTemplateInput.addEventListener('input', () => {
    customTemplate = editorTemplateInput.value.trim();
    lsSet(EDITOR_TEMPLATE_KEY, customTemplate);
    refreshEditorLinks();
  });

  function refreshEditorLinks() {
    vscodeLink.textContent = `Open in ${EDITORS[editorId].label}`;
    if (selectedEl && selectedEl.isConnected) renderPanel();
  }

  window.addEventListener('resize', () => {
    if (keycap.style.left) {
      const rect = keycap.getBoundingClientRect();
      applyKeycapPos(clampKeycapPos(rect.left, rect.top));
    }
    if (panel.style.left) {
      const rect = panel.getBoundingClientRect();
      applyPanelPos(clampPanelPos(rect.left, rect.top));
    }
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
    if (structureTypes.size && inspecting && selectedEl && selectedEl.isConnected) {
      renderStructure(selectedEl);
    } else {
      structureLayer.replaceChildren();
    }
  }

  // --- Task 5: on-page structure visualization ----------------------------

  function structureBox(className, x, y, width, height) {
    if (width <= 0 || height <= 0) return null;
    const box = document.createElement('div');
    box.className = `sbox ${className}`;
    box.style.transform = `translate(${x}px, ${y}px)`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    return box;
  }

  // Places a label centered on (cx, cy); when it would overlap an already
  // placed label, it stacks downward until it finds a free spot.
  function placeLabel(placed, text, cx, cy, kind) {
    const label = document.createElement('span');
    label.className = kind ? `slabel slabel--${kind}` : 'slabel';
    label.textContent = String(text);
    structureLayer.appendChild(label);
    const w = label.offsetWidth;
    const h = label.offsetHeight;
    const x = Math.max(4, Math.min(cx - w / 2, window.innerWidth - w - 4));
    let y = Math.max(4, Math.min(cy - h / 2, window.innerHeight - h - 4));
    let guard = 0;
    while (
      guard++ < 24 &&
      placed.some(
        (r) => x < r.x + r.w + 2 && r.x < x + w + 2 && y < r.y + r.h + 2 && r.y < y + h + 2,
      )
    ) {
      y += h + 3;
    }
    label.style.transform = `translate(${x}px, ${y}px)`;
    placed.push({ x, y, w, h });
  }

  function structureNameFor(el) {
    return (
      el.getAttribute(COMPONENT_ATTR) || el.classList[0] || el.tagName.toLowerCase()
    );
  }

  // Maps a CSS property to the structure toggle it belongs to (or null).
  function structureGroup(prop) {
    const p = prop.toLowerCase();
    if (p === 'margin' || p.startsWith('margin-')) return 'margin';
    if (p === 'padding' || p.startsWith('padding-')) return 'padding';
    if (p === 'gap' || p === 'row-gap' || p === 'column-gap' || p === 'grid-gap')
      return 'gap';
    return null;
  }

  // Which structure types actually exist on this element, so the toggles for
  // the ones that don't apply (e.g. no padding) can be muted.
  // A flex/grid container with a non-zero row/column gap.
  function containerHasGap(node) {
    if (!node || node === document.documentElement) return false;
    const cs = getComputedStyle(node);
    if (!/(flex|grid)/.test(cs.display)) return false;
    return (parseFloat(cs.columnGap) || 0) > 0 || (parseFloat(cs.rowGap) || 0) > 0;
  }

  function structureApplicability(el) {
    const cs = getComputedStyle(el);
    const n = (v) => Math.max(0, parseFloat(v) || 0);
    const margin =
      n(cs.marginTop) + n(cs.marginRight) + n(cs.marginBottom) + n(cs.marginLeft) > 0;
    const padding =
      n(cs.paddingTop) + n(cs.paddingRight) + n(cs.paddingBottom) + n(cs.paddingLeft) > 0;
    // Gap applies when the element itself has a gap (between its children) or
    // its parent does (between the element and its siblings) — matching what
    // the on-page gap visualization actually draws.
    const gap = containerHasGap(el) || containerHasGap(el.parentElement);
    return { margin, padding, gap };
  }

  function updateStructureApplicability(el) {
    const applies = structureApplicability(el);
    for (const chip of structureChips) {
      const ok = applies[chip.dataset.type];
      chip.classList.toggle('schip--muted', !ok);
      chip.title = ok ? '' : `No ${chip.dataset.type} on this element`;
    }
  }

  // Item 4: highlight declaration rows whose property matches an active toggle,
  // so the user sees exactly which code drives the on-page annotation.
  function applyStructureHighlight() {
    for (const row of stylesBox.querySelectorAll('.decl[data-sgroup]')) {
      row.classList.toggle('decl--hl', structureTypes.has(row.dataset.sgroup));
    }
  }

  function renderStructure(el) {
    structureLayer.replaceChildren();
    const placed = [];
    const add = (box) => box && structureLayer.appendChild(box);

    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const num = (value) => Math.max(0, parseFloat(value) || 0);
    const mt = num(cs.marginTop);
    const mr = num(cs.marginRight);
    const mb = num(cs.marginBottom);
    const ml = num(cs.marginLeft);
    const pt = num(cs.paddingTop);
    const pr = num(cs.paddingRight);
    const pb = num(cs.paddingBottom);
    const pl = num(cs.paddingLeft);

    // Item 4: each kind only draws when its toggle is on.
    const showMargin = structureTypes.has('margin');
    const showPadding = structureTypes.has('padding');
    const showGap = structureTypes.has('gap');

    if (showMargin) {
      // Margin: tinted outset strips around the element's box.
      add(structureBox('sbox--margin', rect.left - ml, rect.top - mt, rect.width + ml + mr, mt));
      add(structureBox('sbox--margin', rect.left - ml, rect.bottom, rect.width + ml + mr, mb));
      add(structureBox('sbox--margin', rect.left - ml, rect.top, ml, rect.height));
      add(structureBox('sbox--margin', rect.right, rect.top, mr, rect.height));
    }
    if (showPadding) {
      // Padding: tinted inset strips inside the box.
      add(structureBox('sbox--padding', rect.left, rect.top, rect.width, pt));
      add(structureBox('sbox--padding', rect.left, rect.bottom - pb, rect.width, pb));
      add(structureBox('sbox--padding', rect.left, rect.top + pt, pl, rect.height - pt - pb));
      add(structureBox('sbox--padding', rect.right - pr, rect.top + pt, pr, rect.height - pt - pb));
    }
    if (showMargin || showPadding) {
      // Content box outline frames whichever spacing is shown.
      add(
        structureBox(
          'sbox--content',
          rect.left + pl,
          rect.top + pt,
          rect.width - pl - pr,
          rect.height - pt - pb,
        ),
      );
    }

    // Numeric labels for every visible margin/padding side.
    if (showMargin) {
      if (mt > 1) placeLabel(placed, Math.round(mt), rect.left + rect.width / 2, rect.top - mt / 2, 'margin');
      if (mb > 1) placeLabel(placed, Math.round(mb), rect.left + rect.width / 2, rect.bottom + mb / 2, 'margin');
      if (ml > 1) placeLabel(placed, Math.round(ml), rect.left - ml / 2, rect.top + rect.height / 2, 'margin');
      if (mr > 1) placeLabel(placed, Math.round(mr), rect.right + mr / 2, rect.top + rect.height / 2, 'margin');
    }
    if (showPadding) {
      if (pt > 1) placeLabel(placed, Math.round(pt), rect.left + rect.width / 2, rect.top + pt / 2, 'padding');
      if (pb > 1) placeLabel(placed, Math.round(pb), rect.left + rect.width / 2, rect.bottom - pb / 2, 'padding');
      if (pl > 1) placeLabel(placed, Math.round(pl), rect.left + pl / 2, rect.top + rect.height / 2, 'padding');
      if (pr > 1) placeLabel(placed, Math.round(pr), rect.right - pr / 2, rect.top + rect.height / 2, 'padding');
    }

    // Gap framing only shows with the gap toggle on.
    if (!showGap) return;

    // Tinted strips between a flex/grid container's consecutive children,
    // labeled with the gap distance.
    const drawGaps = (container) => {
      const ccs = getComputedStyle(container);
      if (!/(flex|grid)/.test(ccs.display)) return;
      const colGap = parseFloat(ccs.columnGap) || 0;
      const rowGap = parseFloat(ccs.rowGap) || 0;
      if (!colGap && !rowGap) return;
      const items = [...container.children].filter(
        (child) => child !== host && child.getBoundingClientRect().width > 0,
      );
      for (let i = 0; i < items.length - 1; i += 1) {
        const ra = items[i].getBoundingClientRect();
        const rb = items[i + 1].getBoundingClientRect();
        const vTop = Math.max(ra.top, rb.top);
        const vBottom = Math.min(ra.bottom, rb.bottom);
        const hLeft = Math.max(ra.left, rb.left);
        const hRight = Math.min(ra.right, rb.right);
        if (colGap && rb.left - ra.right > 1 && vBottom - vTop > 4) {
          const width = rb.left - ra.right;
          add(structureBox('sbox--gap', ra.right, vTop, width, vBottom - vTop));
          placeLabel(placed, Math.round(width), ra.right + width / 2, (vTop + vBottom) / 2, 'gap');
        } else if (rowGap && rb.top - ra.bottom > 1 && hRight - hLeft > 4) {
          const height = rb.top - ra.bottom;
          add(structureBox('sbox--gap', hLeft, ra.bottom, hRight - hLeft, height));
          placeLabel(placed, Math.round(height), (hLeft + hRight) / 2, ra.bottom + height / 2, 'gap');
        }
      }
    };

    // The selected element's own gaps (between its children) — this is the gap
    // that shows up in the element's own styles.
    drawGaps(el);

    // Context: the parent outline, the siblings, and the gap between this
    // element and those siblings.
    const parent = el.parentElement;
    if (!parent || parent === document.documentElement) return;
    const prect = parent.getBoundingClientRect();
    add(structureBox('sbox--parent', prect.left, prect.top, prect.width, prect.height));
    placeLabel(placed, structureNameFor(parent), prect.left + 34, prect.top - 9);
    for (const sibling of parent.children) {
      if (sibling === el || sibling === host) continue;
      const srect = sibling.getBoundingClientRect();
      if (srect.width > 0) {
        add(structureBox('sbox--sibling', srect.left, srect.top, srect.width, srect.height));
      }
    }
    drawGaps(parent);
  }

  function scheduleRender() {
    if (!rafId) rafId = requestAnimationFrame(render);
  }

  function renderPanel() {
    if (!selectedEl || !selectedEl.isConnected) {
      panel.hidden = true;
      return;
    }
    updateStructureApplicability(selectedEl);
    const { file, line, component } = sourceInfo(selectedEl);
    // Rule A: the title and its location both open the defining file:line.
    const titleLink = srcLink(file, line);
    titleLink.textContent = `<${component}>`;
    panelTitle.replaceChildren(titleLink);
    panelLoc.replaceChildren(srcLink(file, line));
    vscodeLink.href = editorUrl(file, line);

    const crumbs = componentChain(selectedEl);
    // Item 3: compact summary shown when the breadcrumb is collapsed.
    crumbsSummary.textContent =
      crumbs.length <= 2
        ? crumbs.map((c) => c.name).join(' › ')
        : `${crumbs[0].name} › … › ${crumbs[crumbs.length - 1].name}`;
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

  function cascadeBadge(kind, text) {
    return span(`cascade-badge cascade-badge--${kind}`, text);
  }

  // Rule A: every codebase-derived fact links to its exact source location.
  function srcLink(file, line) {
    const link = document.createElement('a');
    link.className = 'src-link';
    link.textContent = `${file}:${line}`;
    link.href = editorUrl(file, line);
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
      // Item 4: tag the row so an active structure toggle can highlight the
      // exact declarations driving the on-page annotation.
      const sgroup = structureGroup(decl.prop);
      if (sgroup) row.dataset.sgroup = sgroup;
      // Rule A: each declaration opens the editor at its own line.
      const code = srcLink(rule.file, decl.line);
      code.classList.add('decl-code');
      code.textContent = `${decl.prop}: ${decl.value}${decl.important ? ' !important' : ''};`;
      row.append(code);

      // Priority: when more than one matched rule sets this property, tag the
      // winner (with the reason it won) and each loser (with what beat it).
      const c = decl.cascade;
      if (c && c.contested) {
        row.append(
          c.winner
            ? cascadeBadge('win', `WINS · ${c.reason}`)
            : cascadeBadge('lose', `overridden by ${c.winnerSelector}`),
        );
      }

      // Rule B: the explanation and token chains are hover-revealed, not
      // permanently visible. Register them as this row's annotation.
      const note = explainDeclaration(decl.prop, decl.value);
      const noteText = decl.overridden
        ? `Crossed out: a stronger rule overrides ${decl.prop} on this element.${note ? ` (${note})` : ''}`
        : note;
      const tokenNames = decl.overridden ? [] : extractVarRefs(decl.value);
      if (noteText || tokenNames.length) {
        rowNoteData.set(row, {
          note: noteText || 'Uses these design tokens:',
          extras: () => tokenNames.map((name) => tokenChainRow(name, index, el, sheetOrder)),
        });
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
        rowNoteData.set(chip, {
          note: 'A class — a style label on this element that CSS rules target.',
          extras: () => {
            const where = document.createElement('div');
            where.className = 'token-chain';
            where.append(span('token-loc', `styled by ${rule.selector} · `));
            where.append(srcLink(rule.file, rule.line));
            return [where];
          },
        });
        classesBox.append(chip);
      } else {
        const chip = document.createElement('code');
        chip.className = 'class-chip';
        chip.textContent = name;
        rowNoteData.set(chip, {
          note: 'A class — a style label on this element. No rule in your CSS targets it.',
        });
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
    applyStructureHighlight();
  }

  // A plain-language description of what the element is, plus the semantic
  // attributes and visible text an AI would otherwise need a screenshot to see.
  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    let kind;
    if (tag === 'button' || role === 'button') kind = 'a button';
    else if (tag === 'a') kind = el.getAttribute('href') ? 'a link' : 'an anchor';
    else if (tag === 'input') kind = `an input (type=${el.getAttribute('type') || 'text'})`;
    else if (tag === 'select') kind = 'a dropdown (select)';
    else if (tag === 'textarea') kind = 'a text area';
    else if (tag === 'img') kind = 'an image';
    else if (tag === 'svg') kind = 'an icon / graphic (svg)';
    else if (/^h[1-6]$/.test(tag)) kind = `a heading (<${tag}>)`;
    else if (tag === 'p') kind = 'a paragraph';
    else if (tag === 'ul' || tag === 'ol') kind = 'a list';
    else if (['nav', 'header', 'footer', 'main', 'aside', 'section', 'article'].includes(tag))
      kind = `a <${tag}> region`;
    else kind = `a <${tag}> element`;

    const component = el.getAttribute(COMPONENT_ATTR);
    if (component) kind += ` rendered by the <${component}> component`;

    const attributes = {};
    for (const name of ['role', 'aria-label', 'alt', 'title', 'href', 'type', 'placeholder', 'name', 'value']) {
      const value = el.getAttribute(name);
      if (value) attributes[name] = value;
    }

    let text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 100) text = `${text.slice(0, 100)}…`;

    return { kind, text, attributes };
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
      const rect = el.getBoundingClientRect();
      const text = formatAiContext({
        component,
        source: `${file}:${line}`,
        breadcrumb: componentChain(el).map((crumb) => crumb.name),
        tag: el.tagName.toLowerCase(),
        classes: [...el.classList],
        element: describeElement(el),
        layout: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
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
    } else {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onViewportChange, { capture: true });
      window.removeEventListener('resize', onViewportChange);
      hoverEl = null;
      selectedEl = null;
      // Per-type toggles persist across sessions; just clear the on-page layer.
      structureLayer.replaceChildren();
      panel.hidden = true;
      hoverBox.hidden = true;
      selectedBox.hidden = true;
      hideNoteCard();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }
  }

  window.addEventListener('keydown', onKeyDown, true);
}
