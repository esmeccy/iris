# Iris — Product Concept: A Code Inspector for Designers

> Name: **Iris** (the eye's aperture; also the rainbow goddess — fitting for a tool that manages color tokens). npm package: `vite-plugin-iris`. Hotkey ⌥+I, keycap entry button "I" — name, hotkey, and entry point form one system.

> An inspector that lives inside your own running app, translating every pixel on screen back to the facts in your codebase: which component, which styles, which token, defined where. Built for designers and front-end developers who are stepping into code and building products with AI.

---

## 1. Problem definition

AI lets designers participate directly in building product code, but it creates a new gap: **you can see the result, but you can't find the source.**

- A designer's starting point is the live product (the app running in the browser), not the IDE. The IDE can't visualize, so they always go back to the live version to check the actual result.
- When they want to change an element, they must do DevTools archaeology: expand layers of style rules, mentally reconstruct cascade overrides, face minified class names — and still not know which file to touch.
- Asking AI to make the change is imprecise — "make that button bigger" sends the AI grepping blindly, editing the wrong thing and wasting tokens.
- AI-generated code makes the mess worse: design tokens defined redundantly across multiple CSS files, identical card styles copy-pasted instead of extracted into components, hard-coded hex colors bypassing the design system. All of it invisible to the designer.

No existing tool closes this gap (landscape as of mid-2026):

| Tool | Gap |
|---|---|
| Chrome DevTools | Understands the DOM, not your codebase (components, tokens, file structure) |
| LocatorJS / vite-inspector / TanStack Devtools source inspector | Click-to-source is now a solved (and crowded) problem — but they all stop at "open the file." No style explanation, no token chain, no override analysis. Treat this as foundation, not differentiation. |
| React DevTools | Component tree, but no CSS, token, or dependency story |
| **Stagewise** (YC-backed, €20/mo) and other browser-aware AI agents (Onlook, Tidewave) | The closest strategic neighbor — click an element, an AI agent edits the code for you. Opposite positioning: they sell *automation* ("let AI see and change it"), we sell *understanding and control* ("let the human see, then direct the AI"). As Stagewise grows heavier (a full agentic IDE), the lightweight read-only inspector niche opens up. |
| TokenOps and CSS-variable web utilities | Token auditing exists only on the Figma side (auditing designs, not code) or as one-off paste-in web tools. Nobody does a live, in-dev-environment token audit of the actual codebase. |
| Storybook / Ladle / Histoire | All require hand-written stories that teams never keep maintained; no auto-generated, zero-config component inventory with duplicate detection exists. |

**Positioning: DevTools that understands your codebase, a translator into designer language, precision guidance for AI collaboration. The moat is "explain + govern" (style translation, token audit, component map) — not click-to-source, and not AI editing.**

## 2. Target users

Three groups, who share one trait: **the live app is their source of truth** — they need to trace pixels back to code, not derive pixels from code.

| User | Profile | Features they depend on most |
|---|---|---|
| **Designers who don't know code** | Fluent in Figma, not CSS; produce code through AI tools (v0 / Lovable / Cursor) without writing it themselves | Plain-language annotations, visual redline overlays, breadcrumb navigation, AI-assisted install, "describe intent → generate prompt", the read-only promise (their biggest fear is breaking things) |
| **Designers / front-end devs who know code** | Can read and write code, but need to build a mental map fast when inheriting AI-generated or legacy codebases | Real class names + file locations, VS Code jump, token conflict audit, component library governance, "should-be-a-component" detection |
| **Vibe coders** | Build mostly through AI; may be designers or anyone who cares about front-end/visual quality; codebase is largely AI-generated | Copy AI context (precise targeting, saves tokens), token/duplicate-pattern audits (cleaning up AI's mess), incidental learning mode |

The three groups don't need three interfaces: the "translation as annotation, not replacement" design lets one panel serve them all — beginners read the annotations, experienced users scan the real names, vibe coders copy context straight to their AI.

Who it's NOT for: pure no-code users (who never touch or own a codebase), back-end developers who don't look at their product in a browser.

## 3. Product form

**A Vite plugin + an overlay injected into the page (dev-mode overlay).**

- The plugin itself has no UI: once installed, it silently tags every JSX element with its source location at compile time, scans tokens and components, and injects the overlay script. Dev mode only — it never reaches the production build.
- All UI is the in-browser overlay: the designer opens `localhost:5173` as usual and presses a hotkey to enter inspect mode; otherwise it is completely invisible.
- It is not a standalone app, not a browser extension, not an IDE panel — it lives inside the user's own app, which is why it can render with the app's real styles and access facts that only exist at compile time.

### Installation (designed for non-developers)

1. **One command**: `npx <tool> init` auto-detects the project type, installs the package, edits the config.
2. **Let AI install it**: the website provides a prompt to paste into Cursor / Claude Code — the most natural path for this audience's existing habits.

## 4. Core features: three views + one exit

All three views share the same compile-time scan data and cross-link to each other.

### View 1: Element inspector (micro)

Hotkey → hover highlights elements (showing component name) → click to lock. The panel shows:

- **Component identity**: `<Button />` · `src/components/Button.tsx:24`
- **Breadcrumb**: `Page › Pricing section › Card › Button` (no DOM trees)
- **Applied classes, explained line by line**: real name on the left, plain language on the right
  - `px-4 py-2` → padding 16/8
  - `bg-primary-600` → fill · brand primary, token chain: `primary-600 → #534AB7`, defined in `tailwind.config.ts:18`
  - Overridden (losing) classes shown struck through
- **Visual annotations**: Figma-style redlines drawn on the page for padding/margin/gap
- **Progressive disclosure**: raw CSS rules and cascade origins collapsed by default; expand to dig deeper

The essential difference from DevTools: DevTools answers "what CSS does the browser see"; this product answers "**what in my codebase** makes it look this way."

### View 2: Token index (macro audit)

A global view, no element click required:

- **Definition side**: every design token and where it's defined; tokens defined in multiple files are flagged red as conflicts, with the finally-effective value determined by load order — the "same token defined in several CSS files" problem becomes visible at a glance.
- **Usage side**: which files/components use each token and how often; orphan tokens with 0 usage flagged as deletable.
- **Hardcode detection**: hex colors written directly, bypassing tokens, listed with locations and the closest matching token suggested (pure color-similarity algorithm).

### View 3: Component library (map)

An auto-generated component overview, zero config (vs. Storybook's hand-written stories):

- Automatically identifies reusable components, sorted by usage frequency; high-frequency components are the "key components."
- Each component: a live-rendered preview (using the app's own styles), props/variants (read from type definitions), usage count and locations, tokens consumed.
- **"Should-be-a-component" detection**: static analysis finds highly similar repeated DOM/style patterns (the classic AI-generated-code disease), suggests extraction, and can generate AI refactoring context in one click.

### Exit: handoff actions

- **Open in VS Code**: direct jump via the `vscode://file/path:line` protocol.
- **Copy AI context**: generates a structured description (component, file location, current styles, tokens) to paste to an AI for a precise edit.
- **Describe intent → generate prompt**: the designer types what they want in plain language ("make this button bigger, use the brand color"); the tool combines it with the location facts into a precise AI prompt.

## 5. Design principles

1. **Translation is annotation, not replacement.** Class names are always present and always copyable (they are the anchor for searching, prompting, and talking to developers); plain-language explanations sit beside them. Beginners read the annotations, experts scan the real names — one interface serves both, no mode switch.
2. **Visual first.** Spacing and sizing are drawn (redlines), not described in words.
3. **Teaching as a side effect.** Every property has a tappable one-line explanation ("`flex-1` = stretch to fill remaining space"). Designers learn to read code while inspecting their own product — more effective than any tutorial, because every example is their own product.
4. **The control promise (refined from "read-only").** The original rule was "Iris never writes code." The refined rule: **Iris only performs deterministic fixes — previewed and confirmed one by one; anything generative goes to the user's AI.** A deterministic fix has exactly one mechanical answer (swap `#3b82f6` for `var(--brand-primary)`): Iris may execute it after showing a per-change preview the user explicitly confirms. A generative fix involves judgment (replace hand-rolled markup with `<ModalHeader/>` — prop mapping, restructuring): Iris only detects it and generates a precise refactoring prompt for the user's AI agent. The spirit was never "no writes" — it is "no change outside the user's sight and control." This line is also the strategic boundary vs. Stagewise: they generate edits with AI; Iris never does.
5. **If static analysis can answer it, never spend AI on it.** Where it's defined, who uses it, what overrides what — all deterministic compile-time facts, zero token cost, and more accurate than AI guessing. AI is invoked precisely, and only when something needs to *change*.

## 6. Technical approach

**First target stack: React + custom CSS (incl. CSS custom properties) + Vite** — following the founder's own test-bed project, ensuring goal #1 (solve my own pain) and a tight dogfooding loop. Technically also the most direct path: tokens ARE CSS variables, and "the same token redefined across files" is native to this stack.

| Module | Approach |
|---|---|
| Element → source mapping | Babel/SWC transform injecting `data-source="file:line"` into JSX in dev mode (cf. LocatorJS's babel plugin) |
| Overlay UI | Overlay script injected by the Vite plugin, style-isolated via Shadow DOM |
| CSS/token parsing | PostCSS scans all CSS files, building a dual index: "selector → file:line" and "custom property definitions/usages"; override resolution by load order |
| Component analysis | Compile-time traversal of component files, reference counting, props/variants from TS types |
| Duplicate pattern detection | Similarity comparison of DOM structure + style sets (static analysis) |
| Editor jump | `vscode://` URL scheme |

Later expansion (for open-source reach): **Tailwind resolution module** (parse tailwind.config for token chains — the largest AI-coding audience) → Next.js adapter → CSS Modules / CSS-in-JS → other frameworks.

## 7. MVP scope and build steps

MVP ambition level = "identify + hand off" (no in-overlay direct editing — that's Onlook's territory, deferred).

1. **Prove the "element → source" pipeline** (the critical technical validation): Vite plugin + Babel injecting `data-source`. If this works, the product stands — so it goes first.
2. **Click picking + overlay skeleton**: hotkey → hover highlight → click to lock a panel showing just component name and file location.
3. **Style and token resolution** (the soul of the product): per-class explanations + token chains + override flags. Done well, this already beats DevTools.
4. **Handoff actions**: VS Code jump + copy AI context.
5. **Dogfood for a week on the founder's own project (React + custom CSS)**: polish the pain points (deep nesting display, third-party component handling, etc.).

Token index, component library view, and intent-to-prompt are phase two, after MVP; Tailwind support ships with the open-source release.

Estimate: steps 1–4, a designer + AI pair, roughly 2–4 weeks to a usable prototype.

### Goals and positioning

**Primary goal: build it for myself, and as a portfolio side project** demonstrating product thinking and design × code ability as a product design graduate. Commercial potential is explicitly deferred — it would require validating the size and willingness-to-pay of the "designers who own a codebase" segment first, and the fastest way to learn that happens to be the same path: build, open-source, watch who shows up.

This positioning changes execution priorities:

- **Cut scope harder**: self-use + portfolio means no Tailwind support, no multi-persona compromises in v1. MVP steps 1–4 plus one token-audit feature is a complete story. A polished small thing beats an unfinished big one.
- **The decision trail IS the case study**: problem framing (the live app is the designer's source of truth), the principle reversal ("translation as annotation, not replacement"), persona sequencing, competitive positioning vs. Stagewise (control vs. automation), and the honest risk analysis below — these document product judgment better than any feature list.
- **Demo video first**: a 30–60s clip (hotkey → hover → click → panel → VS Code jump) at the top of the README and portfolio site. The interaction design of the overlay is itself a design artifact.
- **The README is the landing page**: most reviewers will read it without installing. Its narrative quality (problem → insight → principles → demo) gets seen before any code does.
- **Founder-user fit as narrative**: "a designer stepping into code, who used AI to build the tool she needed" — the tool's target user is its maker.

### Later-stage roadmap (post-v1, prioritized)

Ordered by founder-pain first (token confusion is the maker's own biggest pain) and dogfooding value. Each item lists its trigger condition where relevant.

1. **Token library view + design-drift detection** — the global token audit (definitions, conflicts, effective values, orphans) plus flagged hardcoded values with nearest-token suggestions. "Design drift" and a compliance signal (e.g. "82% of styles are tokenized") are the marketing language for this. The founder's own pain: "what's tokenized, and what token should I use?"
2. **Token picker** — the in-place answer to "what token should I use *here*": when inspecting any element, the panel suggests the nearest matching token for each hardcoded value. Same data as the library view, embedded in the daily workflow — likely higher frequency of use than the global view.
3. **"Hex Killer" — deterministic token fixes** — Iris flags a hardcoded value, shows a per-change preview (file, line, before → after), the user confirms each change, Iris executes the mechanical swap. Allowed under the refined control promise (deterministic, previewed, confirmed). No batch silent fixes.
4. **MCP server — become the AI editor's context provider** — instead of copy-paste, Cursor / Claude Code query Iris directly via MCP: "which element is the user pointing at, its component chain, its file:line, the project's allowed tokens." Positioning: don't compete with AI editors; be their eyes. Also a strong 2026 portfolio signal.
5. **Component library view** — the auto-generated, zero-config component map (usage counts, variants, live previews).
6. **Component overlap detection** — "this hand-rolled markup is 94% similar to `<ModalHeader/>`" → detection + a precise refactoring prompt for the user's AI. Generative fix, so Iris never executes it (control promise).
7. **unplugin migration** — adopt the unplugin architecture to support webpack/Next/Turbopack with one codebase. Trigger: real users requesting non-Vite support after open-source release. Not before — deliberate narrowness is the current defense.

**Evaluated and rejected** (kept here because the reasoning is part of the product judgment):

- **Proxy-based zero-config injection (`npx iris-dev` proxying the dev server)** — a proxy only sees compiled output; all of Iris's precision (file:line tagging, CSS index) comes from compile time. This path degrades the product to runtime guessing. Zero-config is achieved instead via `npx iris init` (auto config edit) + AI-assisted install.
- **One-click automatic fixes without preview** (auto "Sync to Token", auto component replacement) — violates the control promise; this is the Stagewise direction and abandoning the boundary unfocuses the product.
- **Freemium pricing design ($8–15/mo tiers, B2B seats)** — not wrong, premature. Requires users and retention data that don't exist yet. Revisit only with real post-release usage. (The B2B "governance dashboard" idea — team-level drift scoring — is noted as the most plausible eventual monetization.)
- **Two-way Figma sync** — an engineering graveyard (conflict resolution, API limits, data-model mismatch) competing with Figma's own Code Connect. The acceptable future version is one-way read-only export of code tokens to Figma Variables format.

## 8. Honest risks and weaknesses (product/business view)

1. **Dev tools are notoriously hard to monetize.** Developers expect free; designers don't buy dev tools. LocatorJS never commercialized. Realistic paths are open-source-for-distribution with paid team features — or accepting this as a credibility project, which is the chosen framing.
2. **Window risk: AI may absorb this layer.** The core bet is "humans need to understand code to control AI." If agents become reliably accurate, the understanding need shrinks. Platform absorption is the nearer threat: TanStack Devtools already ships a source inspector; Vite/Next could build this natively. The moat is taste and integration, not technology.
3. **The target segment is a transition zone.** Designers-entering-code may "graduate" to real DevTools, or stay inside walled gardens (Lovable/v0 have their own visual editors and never touch a Vite project). The defensible segment — designers who own their codebase — is growing but unproven in size. This is the assumption most worth validating.
4. **Maintenance burden for a solo builder.** Front-end stack fragmentation (Tailwind v4, CSS-in-JS, RSC, Svelte…) makes each adapter a liability; LocatorJS is the cautionary tale. Defense: keep support surface deliberately narrow.
5. **Distribution mismatch.** Dev tools spread via GitHub/HN; designers aren't there. Designer channels don't install npm packages. Likely answer: content marketing (teaching designers to read code, with the tool as the vehicle). Also: the "saves AI tokens" pitch depreciates as inference costs fall — don't center it.

## 9. Open questions

- How should elements from third-party component libraries (shadcn/ui, MUI) be attributed and explained?
- With deep component nesting, how many breadcrumb levels are most useful?
- Overlay performance: the impact of full-page tagging on dev experience in large apps needs real measurement.
- Naming and open-source strategy: whether to open-source the core plugin, and which commercial model (e.g. hosted team component library) — decide after validation.