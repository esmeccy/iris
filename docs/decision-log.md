# Decision log

Only decisions worth remembering. Merge duplicates; archive outdated entries.

---

### Positioning: explain + govern, not click-to-source and not AI editing
**Decision:** Iris is "DevTools that understands your codebase." The moat is style translation, token audit, and component map — explicitly *not* click-to-source (solved, crowded) and *not* AI editing.
**Reason:** Click-to-source is commoditized (LocatorJS, vite-inspector, TanStack). AI editing is Stagewise's heavier path. The open niche is the lightweight read-only *understanding* layer.
**Tradeoff:** Forgoes the flashier "AI changes it for you" demo; bets on a subtler value prop that's harder to market to designers.
**Future rule:** When evaluating a feature, ask "does this help the human understand and direct?" If it instead automates the change, it's out of scope.

### The control promise (refined from "read-only")
**Decision:** Iris performs only **deterministic fixes** — previewed and confirmed one by one (e.g. swap `#3b82f6` → `var(--brand-primary)`). Anything **generative** (judgment, restructuring) is detected only, and turned into a precise AI prompt for the user's agent.
**Reason:** The original "Iris never writes code" was too absolute; the real spirit is "no change outside the user's sight and control." This is also the strategic boundary vs. Stagewise (they generate edits; Iris never does).
**Tradeoff:** Some mechanical fixes still require per-change confirmation clicks — slower than batch auto-fix, by design.
**Future rule:** Never batch-fix silently. Never let AI generate edits inside Iris. Deterministic = one mechanical answer = allowed with preview.

### Static analysis first; AI only for change
**Decision:** Where a token is defined, who uses it, what overrides what — all answered by compile-time static analysis, never AI.
**Reason:** Deterministic facts are zero-cost, more accurate than AI guessing, and offline.
**Tradeoff:** Limits supported stacks to what the static analyzers can parse (React + custom CSS first).
**Future rule:** If static analysis can answer it, never spend AI/network on it. Constraint: no network calls at all in the overlay.

### Deliberate stack narrowness for v1
**Decision:** Support React + custom CSS (CSS custom properties) + Vite only. No Tailwind, no Next, no CSS-in-JS in v1.
**Reason:** Self-use + portfolio framing means a polished small thing beats an unfinished big one. Adapter fragmentation is the solo-maintainer death trap (LocatorJS cautionary tale).
**Tradeoff:** Excludes the largest AI-coding audience (Tailwind) at launch.
**Future rule:** Widen support only on real post-release user demand. unplugin migration is the eventual path, not a v1 concern.

### Design Rule A — every fact is a link
**Decision:** Anything in the panel originating from a line in the codebase must be clickable and open VS Code at that exact `vscode://file/<abs-path>:<line>`: component names, class names, individual CSS properties, token names, every breadcrumb level. No dead text.
**Reason:** The product's whole value is "find the source." Plain-text facts break that promise mid-panel.
**Tradeoff:** Every fact-rendering code path must thread a file:line; more plumbing.
**Future rule:** New panel content that names a codebase fact must ship with its file:line link. Affordance: underline-on-hover + small ↗.

### Design Rule B — annotations hidden until hover
**Decision:** Plain-language explanations are not permanently visible. Default shows only real identifiers/values; hovering a row reveals its annotation (150ms hide delay); a pin icon keeps it open per-row. No global "help mode" toggle.
**Reason:** Real identifiers are the anchor (for search, prompts, talking to devs); annotations serve beginners without crowding experts. One interface, no mode switch. A mode is one more thing to remember.
**Tradeoff:** Discoverability of annotations depends on hover — invisible until the user explores.
**Future rule:** Never add a global mode toggle. Identifiers always verbatim and copyable; plain language only as on-demand annotation. Reserve space / float to avoid layout jump on reveal.

### No tree view
**Decision:** Never render an abstract DOM/component tree. Spatial on-page visualization (box-model strips, parent/sibling outlines drawn over the live element) serves the same need.
**Reason:** Abstract trees are exactly the developer-brained UI this product avoids; designers think spatially.
**Tradeoff:** On-page overlays are harder to build (scroll/resize recompute, collision avoidance) than a static tree.
**Future rule:** Structure understanding is always drawn on the page in designer language, never as a panel tree.

### Overlay design system: Apple-HIG tokens, graphite accent, color reserved for meaning
**Decision:** The overlay UI uses a CSS-custom-property token foundation (HIG-style): a graphite accent (near-black light / white dark), frosted-glass chrome, squircle keycap, thin-line mask icons, elevation + radius scales. Saturated color is reserved **exclusively** for box-model/structure semantics (margin = orange, padding = green, gap = purple).
**Reason:** The overlay is the portfolio's most-seen surface and must read as polished native chrome over any host app. Reserving color for meaning means every saturated pixel signals something.
**Tradeoff:** A restrained, near-monochrome chrome is less immediately eye-catching than a branded-color UI.
**Future rule:** Don't introduce decorative color into the chrome. New semantic categories may claim a color; UI furniture uses the graphite/glass tokens.

### Theme: CSS-variable-driven Auto · Light · Dark, single source of truth
**Decision:** Theming is driven entirely by CSS — a shared `DARK` override string is applied by both the manual `:host([data-theme="dark"])` selector and the `prefers-color-scheme: dark` + `[data-theme="auto"]` path. JS only writes the `data-theme` host attribute and persists the choice to `localStorage` (`iris:theme`). Default is `auto`.
**Reason:** One source of truth prevents light/dark drift. Auto lets the inspector match the host app's appearance so it feels native. Pure-CSS switching keeps JS trivial and avoids re-render flicker.
**Tradeoff:** All themeable values must be expressed as tokens up front; one-off hardcoded colors break theming silently.
**Future rule:** Every new color/elevation in the overlay must be a CSS variable with a dark override in `DARK`. Never hardcode a color that should respond to theme.
