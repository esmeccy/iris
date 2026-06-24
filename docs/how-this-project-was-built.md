# How this project was built

A running record of *what changed → why → impact*. Newest entries at the bottom of each section. This tracks product/design evolution, not code.

---

## Original intent

**Iris** (npm: `vite-plugin-iris`) is a code inspector for designers. The core insight: for designers stepping into code with AI, **the live app is the source of truth — they can see the result but can't find the source.** Iris translates every pixel on screen back to the facts in the codebase (which component, which styles, which token, defined where).

Positioning is deliberate: *DevTools that understands your codebase* — "explain + govern," not click-to-source (a solved, crowded problem) and not AI editing (Stagewise's territory). The strategic boundary vs. Stagewise is **control vs. automation**: Iris lets the human see and direct the AI; it never generates edits itself.

Primary goal is explicitly **self-use + portfolio** (product-design graduate demonstrating product thinking × design × code), with commercial potential deferred until the "designers who own a codebase" segment is validated. This reframes execution: cut scope hard, the decision trail *is* the case study, the README is the landing page.

Form: a Vite plugin (no UI; tags JSX with source location at compile time, scans tokens/components, injects the overlay) + a Shadow-DOM overlay injected into the dev page. Dev mode only. First target stack: **React + custom CSS (CSS custom properties) + Vite** — the founder's own dogfooding loop.

---

## Major milestones

### MVP (steps 1–4) — built and working
1. Element → source pipeline (Babel injecting `data-iris-source="file:line"` into JSX, dev only) — the critical technical validation, so it went first.
2. Click picking + overlay skeleton (hotkey → hover highlight → click to lock panel).
3. Style & token resolution (per-class explanations, token chains, override flags) — "the soul of the product"; this is what beats DevTools.
4. Handoff actions (VS Code jump via `vscode://`, copy AI context).

### Rename: devlens → iris
Project renamed to **Iris** (the eye's aperture; also the rainbow goddess — fitting for a color-token tool). Name, hotkey (⌥+I), and keycap entry button "I" form one system. Touched package names, `data-iris-*` attributes, virtual modules, UI copy, tests.

### Iteration 2 — dogfooding backlog (Tasks 1–5)
Driven by findings from dogfooding on a real project, plus two cross-cutting **design rules** (see decision log):
- **Task 1 — Keycap entry button**: visible, draggable entry point styled as a keyboard keycap (position persists in localStorage). Replaced hotkey-only activation.
- **Task 2 — Breadcrumb upgrade**: each level shows component name + `page`/`component` type badge; hover reveals file:line + relation. Level click re-targets; path click opens editor.
- **Task 3 — Rule A everywhere**: every codebase-derived fact (title, class names, CSS properties, tokens) made clickable to its exact file:line.
- **Task 4 — Rule B annotations**: plain-language explanations hidden until hover (150ms hide delay), pinnable per-row; no global "help mode."
- **Task 5 — Structure visualization**: on-page box-model strips (padding/margin tints), labeled parent outline, sibling outlines, flex/grid gap labels. Spatial, not a tree view.

### Design-system overhaul (overlay visual foundation)
**What changed:** Replaced the ad-hoc overlay styling (hardcoded blues/purples, `#1c2433` chips) with an Apple-HIG-inspired token foundation defined as CSS custom properties on `:host`: graphite accent (near-black in light, white in dark), frosted-glass chrome (backdrop-blur chips/pills/keycap), a squircle keycap, thin-line mask icons, an elevation scale, and a radius scale. Added **light / dark / auto theming** with a segmented **Auto · Light · Dark** toggle in the panel, persisted to `localStorage` under `iris:theme`.

**Why:** The overlay is itself a design artifact and the portfolio's most-seen surface (demo video, README). Saturated colors are now reserved exclusively for box-model/structure semantics (margin = orange, padding = green, gap = purple), so the only color in the UI carries meaning. Auto mode lets the inspector match the host app's appearance so it reads as native chrome.

**Impact:** One source of truth for theme tokens (a shared `DARK` override string used by both the manual `[data-theme="dark"]` path and the `prefers-color-scheme` auto path). Theme switching is pure CSS — JS only sets a host attribute. Reduced-motion is respected globally.

---

## Reflections

- The product's principle reversals (translation as *annotation, not replacement*; the refined *control promise*) are the case study, more than any feature list. Keep documenting the reasoning, not the code.
- Deliberate narrowness (React + custom CSS only, no Tailwind in v1, Vite only) is the defense against the solo-maintainer fragmentation trap that killed LocatorJS.
