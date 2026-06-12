# Claude Code Kickoff Brief: Element Inspector MVP, Steps 1–2

> How to use: create an empty folder, put this file and the Product Concept doc inside, start Claude Code in that folder, and say: "Read both documents and execute Step 1 of the brief." Move to the next step only after each step passes acceptance.

---

## Project background (context for Claude Code)

I'm building a dev-mode inspection tool for designers/front-end developers: a Vite plugin that injects an overlay into the page during development — click any element to see its component, source location, applied CSS, and design tokens. Full vision in the Product Concept doc in this folder. We're starting from zero and building only MVP Steps 1 and 2.

**Stack**: React 18 + plain CSS (CSS custom properties as tokens) + Vite 5. No Tailwind, no CSS-in-JS.

**Project structure**:

```
devlens/
├── packages/
│   └── inspector/          # The Vite plugin (a future standalone package)
│       ├── index.js        # Plugin entry: JSX tagging + overlay injection
│       └── overlay.js      # Browser-side overlay script
└── demo/                   # Sample app (test bed)
    ├── index.html
    ├── vite.config.js      # references ../packages/inspector
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── components/     # Button.jsx, Card.jsx, Badge.jsx
        └── styles/         # global.css, components.css, legacy.css
```

Demo requirements: a simple landing page (heading, a few cards, buttons, badges) with nested components (App → Section → Card → Button); CSS spread across 3 files, with `--color-primary` **deliberately** defined in both global.css and legacy.css with different values (a test scenario for future token-conflict detection).

---

## Step 1: Element → source tagging (the core technical validation of the whole product)

### What to build

Write the Vite plugin `packages/inspector/index.js`. In **dev mode only** (`apply: 'serve'`), transform `.jsx` files under `demo/src`, injecting two attributes into the JSX of every **native DOM element** (lowercase tags like `div`, `button`):

- `data-devlens-source="src/components/Button.jsx:12"` (path relative to project root + the JSX element's starting line number)
- `data-devlens-component="Button"` (the name of the enclosing component function)

### Technical requirements

- Parse with `@babel/parser` (`sourceType: 'module'`, plugins include `jsx`); insert text with `magic-string` (append the attribute string right after the tag name at `node.name.end`). Do **not** regenerate code with a full babel transform — keep the rest of the source byte-identical and let @vitejs/plugin-react process it normally. The plugin therefore needs `enforce: 'pre'`.
- Component name detection: maintain a scope stack — push on entering a capitalized FunctionDeclaration, or a VariableDeclarator whose capitalized identifier is assigned an arrow/function expression; pop on exit; use the stack top when tagging.
- Only tag lowercase JSXIdentifiers (native elements). Don't tag capitalized custom components (props would pass through and create noise).
- Only transform files under the project's `src/`; exclude `node_modules`.
- Production builds (`vite build`) must be completely unaffected.

### Acceptance criteria (all must pass)

1. `npm run dev` starts the demo; inspecting any button in browser DevTools shows the `data-devlens-source` and `data-devlens-component` attributes.
2. The file path and line number in the attributes match the real source location (spot-check 3 elements manually).
3. Nested components resolve correctly: for a button inside a Card, `data-devlens-component` must be `Button` (the immediate wrapper), not `Card`.
4. `vite build` succeeds and the output contains **no** data-devlens attributes.
5. Write a minimal automated test: run the transform on a fixed JSX string and assert the output contains the expected attributes (use vitest).

---

## Step 2: Overlay skeleton (hover highlight + click panel)

### What to build

The plugin injects `<script type="module" src="/@devlens/overlay">` via `transformIndexHtml`, serving the overlay code through `resolveId`/`load` hooks. Overlay behavior:

- **Hotkey `Alt+I` (Option+I on macOS) toggles inspect mode**; press again or `Esc` to exit.
- In inspect mode, on mouse move: find the nearest element with `data-devlens-source` and draw a highlight box (a `position: fixed; pointer-events: none` border div tracking the target's `getBoundingClientRect()`), with a small label showing `<ComponentName> · file:line`.
- **Click to lock**: open a panel fixed to the right side (style-isolated with Shadow DOM to avoid polluting or being polluted). For this step it shows only:
  - Component name + file:line
  - Breadcrumb: walk up the ancestors collecting `data-devlens-component`, displayed as `App › Section › Card › Button`, each level clickable to switch the selected target
  - The element's class list (names only for now — CSS resolution is Step 3)
  - An "Open in VS Code" button: `vscode://file/<absolute-path>:<line>` (the plugin must pass the project root's absolute path to the overlay)
- While inspect mode is on, suppress the page's default click behavior (`preventDefault` + `stopPropagation` in the capture phase).

### Acceptance criteria

1. After Alt+I, hovering any element shows the highlight box and label; after Esc, page behavior returns fully to normal.
2. Clicking a button inside a Card shows Button's info in the panel; the breadcrumb is correct and clickable.
3. "Open in VS Code" actually opens the file in VS Code at the right line.
4. The overlay's own DOM is never highlighted/selected by itself.
5. With inspect mode off, the page shows no perceptible change (no style pollution, no noticeable performance impact).

---

## Working agreements (added 2026-06-11)

- **Ask before guessing.** When the brief is ambiguous, underspecified, or a choice is hard to reverse, Claude Code asks clarifying questions first instead of silently picking an interpretation.
- **Practical pushback welcome.** Before implementing each step, Claude Code reviews it from a working developer's perspective and proactively suggests more practical alternatives (tooling, structure, edge cases). The human decides what to adopt.
- **Decision log** (filled in as decisions are made):
  - 2026-06-11: Pin React 18 + Vite 5 (per brief, matches the dogfood target).
  - 2026-06-11: npm workspaces monorepo; demo imports the plugin as `devlens-inspector` by package name (mirrors future standalone publishing).
  - 2026-06-11: Project scaffolded directly in this folder (Dev-tool/ is the repo root); the two docs stay at top level.
  - 2026-06-11: Transform returns a magic-string source map (`hires`) so dev stack traces/HMR positions stay accurate; plugin filters on the resolved Vite `config.root` + `/src` instead of hardcoding `demo/src`, and strips Vite's `?query` suffixes from module ids.
  - 2026-06-11 (Step 2): Hotkey matches `e.code === 'KeyI'` + `altKey` (Option+I is a dead key on macOS) and excludes Meta/Ctrl so Cmd+Option+I still opens browser DevTools. Overlay exempts its own events via `composedPath().includes(host)` (Shadow DOM retargeting-safe), so the panel stays clickable while page clicks are suppressed. Exiting inspect mode (Esc/Alt+I) closes the panel and clears all state — full reset per acceptance #1. Two highlight boxes: blue follows hover, purple marks the locked selection. Highlight repositions on scroll/resize (rAF-throttled).

## Constraints and principles (apply to every step)

- The tool is **read-only**; no step ever writes to user source code.
- If static analysis can do it, never call any AI/network service.
- Overlay UI copy: code identifiers like class names are always shown verbatim; plain-language explanations appear only as annotations beside them (used from Step 3 on).
- Stop after completing each step and wait for human acceptance; do not proceed to the next step on your own.

## Roadmap beyond this brief (do not execute; for orientation only)

Step 3: CSS/token resolution (PostCSS scan builds the index; the panel explains each class, token chains, override flags) → Step 4: Copy AI context → Step 5: dogfood on my real project. See the Product Concept doc.