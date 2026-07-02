# Claude Code Brief — Iteration 3: Panel UI Redesign

> How to use: put this file in the project root (alongside the Product Concept doc — its §5.5 is the source of truth for these principles). Start Claude Code and say: "Read this brief and §5.5 of the concept doc, then execute Task 1." Complete tasks in order; stop after each for human acceptance.

---

## Background

The element inspector works (steps 1–4) but the panel was "functional but not intentional" — it dumped raw CSS rules, showed every property flat with loud status badges, and buried designer-relevant meaning in hover tooltips. This iteration rebuilds the panel around eight principles (concept doc §5.5). The guiding idea: **the panel answers "what is the final state" by default; everything explaining "why" is quiet and revealed on demand.**

This brief is UI-only. No change to the tagging/scanning engine — only how the collected data is presented.

---

## Task 1: Restructure to "conclusion-first" with four semantic groups

Replace the raw-CSS-rule dump with a grouped, resolved-value view.

- Parse the element's effective styles and bucket them into **four groups**: **Spacing** (padding, margin, gap), **Layout** (display, position, flex/grid, width, height, z-index), **Color & shape** (background, border, border-radius, box-shadow), **Type** (font-family, font-size, font-weight, line-height).
- Each group is a collapsible **section**. Collapsed, a section shows a one-line summary of its key resolved values (e.g. type → `16px · Inter · 400`).
- **Always show the resolved final value, never a pointer.** Walk `inherit` / `var(--x)` / `currentColor` to the end: show `16px · Inter · 400`, not `inherit`. Combine `getComputedStyle` (real value) with the compile-time token index (which token produced it).
- Keep a **"raw CSS" expander** at the bottom as the escape hatch — full rules, by source file, unmodified — for anyone who wants the original.
- One property appears in exactly one group; resolve ambiguities (e.g. `border`) by picking one fixed home (Color & shape) and staying consistent.

**Acceptance**: inspecting the demo Button shows four grouped sections with resolved values; no `inherit`/`var()` appears as a final value; raw CSS still reachable via the bottom expander; `vite build` unaffected.

## Task 2: Quiet default — remove all status badges and color alarms

- **Remove every "WINS / in-effect" badge.** Only effective properties show by default, so "winning" needs no marker.
- **Overridden / multi-definition cases** get only a small **neutral grey** annotation (e.g. `2 defs`) — never amber, never red, never a warning word. It is a fact, not an alert.
- **Saturated red is reserved for genuine errors only** (e.g. a token referencing an undefined variable). Normal multi-file token definitions are NOT errors.
- Squint test for acceptance: the default panel shows **no colored alarms anywhere**.

**Acceptance**: default panel is visually calm/neutral; multi-definition tokens show a grey `2 defs` marker only; no red/amber appears unless there's a true error.

## Task 3: Two-tier interaction model

Two levels, different affordances (concept doc §5.5.5):

- **Sections**: an explicit chevron in the **top-right corner** (`⌄` open / `⌃` collapsed), label on the left. Clicking the section header toggles it.
- **Rows** (individual properties / tokens / classes): **no chevron.** On hover, the row tints to a **neutral grey** background to signal it's interactive. Clicking the row body **expands its detail inline** (not a floating tooltip — it pushes content down, never blocks the view). **Only one detail open at a time**; opening another closes the previous.
- Detail content order: **value → source (file:line) → one-line plain-language explanation**. Sections expand to rows; a row expands to its source detail — same model, two nesting levels, indentation showing depth.

**Acceptance**: section chevrons sit top-right and fold correctly; rows show grey on hover and expand inline on click; only one row detail open at a time; expanded detail never overlaps/blocks other content; works with mouse (verify touch behavior is noted as a follow-up since rows rely on hover).

## Task 4: Three intents per row — expand / open-in-code / copy

Each row carries three intents on separate targets that never collide:

- **Row body click → expand** (see). The whole row is the target.
- **Open-in-code icon → jump to editor** (change): `vscode://file/<abs-path>:<line>` to the line where that property/token is defined.
- **Copy icon → copy** (communicate): copies just that item (the token name, the class, the value).
- The two action icons (copy, open-in-code) appear at the row's **trailing edge only on hover** — invisible at rest (clean default), reachable as soon as the mouse arrives (no need to expand first).

**Acceptance**: hovering a row reveals copy + open-in-code at the trailing edge; copy puts the right single item on the clipboard; open-in-code lands VS Code on the correct defining line; clicking the row body (not the icons) expands instead.

## Task 5: Header, classes, and copy-what-you-point-at

- **Move the primary "Open in editor" button up to the header**, next to the component name + `file:line`. It is the highest-frequency action.
- **Add a "classes" row** below the header: each class the component uses (`button`, `button--primary`) as its own copyable chip.
- **Add "on screen" text** to the header (e.g. `"Get started"`) — the one clue a non-coder always recognizes.
- **Per-item copy everywhere**: component title, each class chip, each token, each property value all individually copyable. Identification priority when building any copied reference: **component name > file:line > on-screen text > classes > DOM tag.**
- **Demote the full AI-context bundle**: the long structured-context copy is no longer a primary button — make it a quiet secondary "full context" entry (e.g. bottom corner), summoned only for a large AI-driven change.

**Acceptance**: Open-in-editor is in the header; classes appear as copyable chips; on-screen text shows; every identifiable item copies individually; "full context" exists but is visually secondary.

## Task 6: Multi-definition / conflict detail (expanded state)

When a row with multiple definitions is expanded, the detail shows (neutral, not alarming):

- `value` — the single resolved final value.
- `source` — each definition listed: the effective one marked with a quiet check + "loaded later", the overridden one(s) muted with "overridden"; each file:line is a jump link.
- A one-line plain-language explanation ("Defined in two files. The one loaded later takes effect.").
- Copy buttons for token name and final value.

**Acceptance**: expanding a multi-def token (the deliberate `--color-primary` conflict in the demo) shows both definitions, clearly marks which is in effect and why, both file links jump correctly, and the whole block reads as neutral information, not an error.

---

## Constraints (unchanged)

- UI-only; do not touch the tagging/scanning engine.
- Read-only; never write to user source.
- Static analysis only; no AI/network calls in the panel.
- Identifiers shown verbatim; plain language only inside expanded details.
- Dev mode only; production builds unaffected.
- Stop after each task for human acceptance.

## Reference

Six mockup states were designed for this redesign (conclusion-first panel, raw-CSS expanded, four-group, copy-what-you-point-at, quiet-resolved, section-vs-row). The final agreed model is: four semantic sections with top-right chevrons; rows with hover-grey + click-to-expand and hover-only copy/open-in-code icons; resolved values only; neutral grey multi-def markers; red reserved for true errors. Concept doc §5.5 holds the full principle list.