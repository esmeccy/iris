# Claude Code Brief — Iteration 2: Dogfooding Backlog

> How to use: put this file in the project root (alongside the previous docs), start Claude Code, and say: "Read this brief and execute Task 1." Complete tasks **in order**; stop after each task and wait for human acceptance before continuing.

---

## Background

MVP steps 1–4 are built and working (element tagging, overlay, CSS/token resolution, handoff actions). This iteration addresses findings from dogfooding on a real project. It is driven by two new **design rules** plus five tasks.

## Two design rules (apply across the whole overlay, now and in future work)

**Rule A — Every fact is a link.** Anything in the panel that originates from a line in the codebase must be clickable and open VS Code at that exact location (`vscode://file/<abs-path>:<line>`): component names, class names, individual CSS properties, token names, every breadcrumb level. Visual affordance: subtle underline-on-hover + a small ↗ on hover. No dead text.

**Rule B — Annotations are hidden until hover.** Plain-language explanations (for classes, CSS properties, tokens) must NOT be permanently visible. Default: show only the real identifiers and values. On hovering a row, its annotation appears (inline, to the right or below). Clicking a small pin icon on the annotation keeps it visible (for users in learning mode). No global "help mode" toggle — we deliberately avoid modes.

---

## Task 1: Keycap entry button

Replace hotkey-only activation with a visible entry point styled as a **keyboard keycap**.

- A single keycap showing **"I"** — styled like a real key: rounded-rect, subtle border, slight bottom shadow to suggest depth, system font. Small (~32px), semi-transparent at rest (e.g. 60% opacity), full opacity on hover.
- **Default position: top-right corner** of the viewport. **Draggable** anywhere; position persists in `localStorage`. While dragging, show no tooltip; a click (no drag movement) toggles inspect mode.
- Hover (at rest): a small tooltip slides out: "Inspect — ⌥ + I".
- Inspect mode ON: the keycap switches to a pressed/active state (accent color, slightly inset look) and the tooltip becomes "Exit — Esc".
- The keycap lives inside the overlay's Shadow DOM, never collides with page content (high z-index), and is excluded from inspection targeting.
- Hotkey ⌥+I and Esc continue to work exactly as before.

**Acceptance**: visible on load at top-right; drag persists across reloads; click toggles inspect mode; rest/hover/active states all render correctly; keycap itself can never be selected by the inspector.

## Task 2: Breadcrumb upgrade

Current `App › Section › Card › Button` is too thin. Each level must convey what the thing *is*.

- Each breadcrumb level shows: **component name** + a small type badge — `page` for route-entry files (e.g. `index.jsx`, files under a `pages/` or routes directory) vs `component` for everything else.
- Hovering a level reveals a tooltip with the full detail: relative file path + line number, and its relation in one short phrase (e.g. "component inside Card", "page root").
- Per Rule A: clicking the file path in the tooltip opens VS Code at that line; clicking the level itself still re-targets the inspector to that ancestor (existing behavior — keep both: level click = re-target, path click = open editor).

**Acceptance**: badges correctly distinguish page vs component in the demo and in a real project; hover tooltip shows correct file:line; both click behaviors work and don't conflict.

## Task 3: Apply Rule A everywhere

Audit the entire panel and make every codebase-derived fact clickable per Rule A:

- Element/component title → component's defining file:line.
- Each class name → the CSS rule's file:line (if multiple rules match, clicking opens the winning rule; other definitions listed in the expanded view, each clickable).
- Each CSS property line → the file:line of the declaration it came from.
- Each token (`--color-primary`) → its defining file:line; if multiple definitions (conflict), each definition is individually clickable.

**Acceptance**: spot-check 5 different facts across 3 elements — every click lands VS Code on the exact correct line; no plain-text dead ends remain in the panel.

## Task 4: Apply Rule B to all annotations

- Remove all permanently-visible explanations from the panel.
- Hovering a class row, CSS property row, or token row reveals its plain-language annotation inline. Mouse-out hides it (150ms delay to prevent flicker).
- Each revealed annotation has a small pin icon; clicking pins it open. Pinned state is per-row and resets when a new element is selected.
- Token rows: annotation includes the resolved chain (`--color-primary → #4F46E5, defined in global.css:12`) and per Rule A the file reference is clickable.

**Acceptance**: panel at rest shows only identifiers/values (clean, compact); hover reveals annotations smoothly without layout jumps (reserve space or float the annotation); pinning works; no global mode toggle exists.

## Task 5: Structure visualization (the big one — do last)

Goal: help users who can't mentally model DOM nesting see **the spatial relationships** around the selected element. NOT a tree view — draw it on the actual page.

When an element is selected (locked), add a "Structure" toggle in the panel. When ON, render on-page:

- **Selected element**: padding visualized as a tinted inset area (one color), margin as a tinted outset area (another color), content box outlined — Figma/DevTools-style box model, but drawn over the live element.
- **Parent**: dashed outline one level up, with a small label (component name or tag). 
- **Siblings**: light dotted outlines with reduced opacity.
- **Gaps**: where the parent uses flex/grid `gap`, draw the gap distance labels between children.
- Small floating labels, never overlapping each other (basic collision avoidance: offset stacking).
- Toggle OFF or selecting a new element clears and redraws. Scroll/resize keeps overlays glued to elements (recompute on scroll/resize, rAF-throttled).

Keep scope tight: one level up (parent) and direct siblings only. No grandparents, no abstract diagram in the panel — that's a possible future iteration.

**Acceptance**: on a nested demo layout (Card with multiple Buttons), toggling Structure clearly shows padding vs margin vs gap, parent boundary, and siblings; labels readable and non-overlapping; no visible lag while scrolling; toggling off restores the page perfectly.

---

## Explicit won't-do list (decided, with reasons — do not implement)

- **Global help mode**: a mode is one more thing to remember; hover + pin (Rule B) achieves the same with zero learning cost.
- **Tree view**: abstract trees are exactly the developer-brained UI this product avoids; spatial on-page visualization (Task 5) serves the same need in designer language.

## Constraints (unchanged from iteration 1)

- Read-only: never write to user source code.
- Static analysis only; no AI/network calls.
- Identifiers always shown verbatim; plain language only as annotations.
- Dev mode only; production builds unaffected.
- Stop after each task for human acceptance.
