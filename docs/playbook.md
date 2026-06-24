# Playbook

Reusable knowledge so future iterations need less correction. Patterns, conventions, and things to avoid.

---

## Architecture conventions

- **Compile-time facts only.** The plugin tags JSX (`data-iris-source`, `data-iris-component`) and builds CSS/token indexes at build time; the overlay consumes that data. No runtime guessing, no network calls from the overlay.
- **Shadow DOM isolation.** All overlay UI lives in a Shadow DOM so the host app's styles never leak in or out. The keycap and overlay are excluded from inspection targeting (never selectable by the inspector).
- **Dev mode only.** Nothing Iris does may reach the production build. Verify any new injection path is dev-gated.

## Design principles (apply to every overlay change)

1. **Translation is annotation, not replacement.** Real identifiers always shown verbatim and copyable; plain language sits beside them, on demand (Rule B). One interface serves beginners and experts — no mode switch.
2. **Every fact is a link (Rule A).** Any codebase-derived value renders with its `vscode://file/<abs>:<line>` link. No plain-text dead ends. Affordance: underline-on-hover + ↗.
3. **Visual first.** Spacing/sizing is *drawn* on the page (redlines, box-model strips), not described in words. Structure is spatial, never a tree.
4. **Color carries meaning.** Chrome uses the graphite/glass tokens. Saturated color is reserved for semantics — currently box model: margin = orange, padding = green, gap = purple. Don't spend color on decoration.
5. **Static analysis before AI.** If a deterministic compile-time fact answers it, never invoke AI. AI is only for generative *change*, handed off as a prompt to the user's agent.

## Design-system / theming patterns

- **Token everything as CSS custom properties on `:host`.** Colors, fills, labels, separators, accent, semantic box-model colors, radii (`--r-xs`…`--r-full`), elevation (`--el-card/pop/panel`), fonts (`--mono`, `--sans`), easing, and mask-icon data-URIs all live as variables. Reference them everywhere; never hardcode a value that should theme.
- **Single-source dark override.** Keep one `DARK` string of token overrides and apply it from both the manual `:host([data-theme="dark"])` selector and the auto `@media (prefers-color-scheme: dark) :host([data-theme="auto"])` path. This is the pattern that prevents light/dark drift — add new dark values here, once.
- **Theme switching is pure CSS.** JS only sets the `data-theme` host attribute (`auto`/`light`/`dark`) and persists to `localStorage`. CSS does the rest — no re-render, no flicker. Default `auto`.
- **Thin-line icons as CSS masks** inheriting `currentColor`, so icons recolor with the theme automatically.
- **Frosted-glass chrome** = `backdrop-filter: saturate(180%) blur(20px)` + `--glass` background + `--glass-border`. Used for floating chrome (keycap, label chips, badge, tooltips).
- **Respect reduced motion globally**: `@media (prefers-reduced-motion: reduce) { * { animation:none; transition:none } }`.
- **Persisted UI state** uses namespaced `localStorage` keys (`iris:theme`, keycap position). Keep the `iris:` prefix.

## QA / acceptance conventions

- Iteration tasks are accepted **one at a time** — stop after each task for human acceptance before continuing.
- Verify new fact-links land VS Code on the *exact* correct line (spot-check several facts across several elements).
- Verify behavior in both the demo *and* a real project (badges, file:line, click behaviors).
- On-page overlays must stay glued to elements on scroll/resize (rAF-throttled recompute) and restore the page perfectly when toggled off.
- Confirm theming holds: light, dark, and auto (toggle the host OS appearance) — no hardcoded color should break.

## Things to avoid

- ❌ Global "help mode" or any mode toggle (Rule B / hover+pin replaces it).
- ❌ Abstract tree views of DOM/components.
- ❌ Decorative saturated color in chrome (color is reserved for meaning).
- ❌ Hardcoded colors/elevations in the overlay — breaks theming silently.
- ❌ AI-generated edits inside Iris, or batch silent fixes (control promise).
- ❌ Network calls / runtime-only inspection (proxy approach was evaluated and rejected — it loses all compile-time precision).
- ❌ Plain-text rendering of any codebase fact (Rule A).
