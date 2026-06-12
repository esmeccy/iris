# Product Concept: A Code Inspector for Designers (working title TBD)

> An inspector that lives inside your own running app, translating every pixel on screen back to the facts in your codebase: which component, which styles, which token, defined where. Built for designers and front-end developers who are stepping into code and building products with AI.

---

## 1. Problem definition

AI lets designers participate directly in building product code, but it creates a new gap: **you can see the result, but you can't find the source.**

- A designer's starting point is the live product (the app running in the browser), not the IDE. The IDE can't visualize, so they always go back to the live version to check the actual result.
- When they want to change an element, they must do DevTools archaeology: expand layers of style rules, mentally reconstruct cascade overrides, face minified class names — and still not know which file to touch.
- Asking AI to make the change is imprecise — "make that button bigger" sends the AI grepping blindly, editing the wrong thing and wasting tokens.
- AI-generated code makes the mess worse: design tokens defined redundantly across multiple CSS files, identical card styles copy-pasted instead of extracted into components, hard-coded hex colors bypassing the design system. All of it invisible to the designer.

No existing tool closes this gap:

| Tool | Gap |
|---|---|
| Chrome DevTools | Understands the DOM, not your codebase (components, tokens, file structure) |
| LocatorJS / click-to-component | Click-to-source, but stops at "open the file" — no style/token/dependency explanation |
| React DevTools | Component tree, but no CSS, token, or dependency story |
| Storybook | Requires hand-written stories; designer teams never keep them maintained |
| Onlook | Takes over the workflow for visual editing instead of explaining existing code |

**Positioning: DevTools that understands your codebase, a translator into designer language, precision guidance for AI collaboration.**

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
4. **The read-only promise.** The tool looks but never touches; changes always go through the user (by hand or via their AI). Stating this prominently removes the "afraid to break it" barrier.
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

### Goals and roadmap

Self-use → open source → commercial: a progression, not a trade-off. First polish it on my own project (high-fidelity needs), then open-source to validate breadth with similar users (naming, docs, distribution effort goes here), then explore commercial boundaries (e.g. team edition, hosted component libraries) once validated.

## 8. Open questions

- How should elements from third-party component libraries (shadcn/ui, MUI) be attributed and explained?
- With deep component nesting, how many breadcrumb levels are most useful?
- Overlay performance: the impact of full-page tagging on dev experience in large apps needs real measurement.
- Naming and open-source strategy: whether to open-source the core plugin, and which commercial model (e.g. hosted team component library) — decide after validation.