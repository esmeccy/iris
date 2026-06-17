# Iris

**See your UI. Find your code.**

Iris is a dev-mode element inspector for people whose source of truth is the *running app* — designers, front-end developers, and vibe coders. Press one key, click any element on your page, and Iris tells you what it is in your codebase: which component, which file and line, which CSS rules style it, and which design tokens those rules use — with every fact one click away from opening in your editor (VS Code, Cursor, Antigravity, or a custom URL scheme).

Unlike browser DevTools (which understand the DOM, not your codebase), Iris answers the question you're actually asking: **"what in *my code* makes it look this way?"**

## What it does

- **Element → source tagging** — every element knows its component and `file:line` (compile-time, via a Vite plugin; JSX and plain HTML both supported)
- **Inspect overlay** — toggle with the on-page keycap button or `⌥ + I` (Option+I); hover to highlight, click to lock the inspector panel
- **Context-first breadcrumb** — `App page › hero header › hero-title h1`: pages, components, and class-named elements, each level clickable to re-target or jump to source
- **CSS resolution** — every rule matching the element with file:line; cascade losers struck through; plain-language explanations revealed on hover (pin the ones you want to keep)
- **Design-token awareness** — CSS custom properties resolved to their effective value with their definition site, and **conflict detection** when the same token is defined in multiple files
- **Structure visualization** — draw the box model (margin/padding/content), parent boundary, siblings, and flex/grid gap distances directly on the live page
- **Handoff actions** — *Open in your editor* at the exact line (VS Code, Cursor, Antigravity, or a custom URL scheme — pick it in the panel or set a default with the `editor` plugin option) and *Copy AI context* (structured markdown describing the element, its rules, and tokens — paste it to your AI for a precise edit)

**The read-only promise:** Iris looks but never touches. It never writes to your source code, never calls any AI or network service (everything is static analysis), and never reaches your production build (`vite build` output is byte-for-byte unaffected).

## Install into your project

Iris is not on npm yet — install it straight from this repo.

### Any Vite project (React, vanilla, …)

```bash
# from your project's root
npm install -D /path/to/iris/packages/inspector
```

Then add it to `vite.config.js` / `vite.config.mjs` (first in the list, before other plugins):

```js
import iris from 'vite-plugin-iris';

export default {
  plugins: [iris() /*, react(), ... */],
};
```

Run your dev server as usual and press `⌥ + I` (or click the keycap in the top-right corner).

**Default editor (optional).** The panel lets you switch editors at runtime, but you can set the initial default:

```js
iris({ editor: 'cursor' }) // 'vscode' (default) | 'cursor' | 'antigravity' | 'custom'
// for 'custom', supply a URL template with {root} {file} {line} placeholders:
iris({ editor: 'custom', editorTemplate: 'myeditor://open?file={root}/{file}&line={line}' })
```

### A plain HTML/CSS/JS folder (no build setup at all)

You don't need to adopt a build tool — Vite just acts as the dev server:

```bash
# from the folder containing your index.html
npm init -y
npm install -D /path/to/iris/packages/inspector
```

Create `vite.config.mjs` next to your `index.html`:

```js
import iris from 'vite-plugin-iris';

export default {
  plugins: [iris()],
};
```

Then serve with `npx vite` and open the printed URL. All `.html` pages are tagged automatically; your files and deployment are untouched.

### Checklist if "nothing happens"

1. `vite.config.mjs` must be in the **same folder you run `npx vite` from** (next to `index.html`).
2. Make sure the browser tab is the **Vite URL** (e.g. `localhost:5173`), not an old server or a `file://` page.
3. View page source: you should see `<script type="module" src="/@iris/overlay">` near `</body>`. If it's missing, the plugin didn't load — restart the dev server.

## Using the inspector

| Action | How |
|---|---|
| Toggle inspect mode | keycap button (drag it anywhere — it remembers) or `⌥ + I` |
| Exit | `Esc` or toggle again |
| Highlight | hover any element |
| Lock the panel | click an element |
| Re-target | click a breadcrumb level |
| Jump to code | click any file:line, class chip, CSS line, or token (opens your chosen editor) |
| Explanations | hover a class or CSS line; pin 📌 to keep one open |
| Box model / gaps on the page | check **Structure** in the panel |
| Hand off to AI | **Copy AI context**, paste into your AI chat |

## Developing Iris itself

```bash
npm install
npm run dev          # React demo  → localhost:5173
npm run dev:vanilla  # vanilla demo → localhost:5173
npm test             # vitest unit suite
```

Repo layout: `packages/inspector/` is the plugin (`vite-plugin-iris`); `demo/` (React 18) and `demo-vanilla/` (no framework) are test beds, each with a deliberate `--color-primary` conflict across CSS files for exercising token-conflict detection.

## Status & roadmap

Iris is a young tool being dogfooded on real projects. Built so far: MVP steps 1–4 (tagging, overlay, CSS/token resolution, handoff) plus multi-stack support and an iteration of UX work. On the horizon: a global token index view, auto-generated component library view, `npx` installer, and Tailwind resolution. See `product.md` for the full vision and `backlog.md` for what real usage has surfaced.
