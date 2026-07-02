import { useEffect } from 'react';
import Button from './components/Button.jsx';
import Card from './components/Card.jsx';

/* Phosphor-style line icons — consistent 1.75 stroke, no icon library. */
const svg = (children) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ICONS = {
  element: svg(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M12 6.5v3M12 14.5v3M6.5 12h3M14.5 12h3" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>,
  ),
  overlay: svg(
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M16 20h3a1 1 0 0 0 1-1v-3" />
      <path d="M9 9l8 3-3.4 1.4L12.2 17z" fill="currentColor" stroke="none" />
    </>,
  ),
  breadcrumb: svg(
    <>
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
      <path d="M7.3 12h2.4M14.3 12h2.4" />
    </>,
  ),
  css: svg(<path d="M9.5 6.5l-4 5.5 4 5.5M14.5 6.5l4 5.5-4 5.5" />),
  token: svg(
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" />
    </>,
  ),
  structure: svg(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <rect x="8" y="8" width="8" height="8" rx="1" strokeDasharray="2.4 2.4" />
    </>,
  ),
  play: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  ),
};

const FEATURES = [
  {
    icon: 'element',
    tone: 'blue',
    title: 'Element → source',
    tag: 'compile-time',
    text: 'Every element carries its component and exact file:line, tagged at compile time — for JSX and plain HTML alike.',
  },
  {
    icon: 'overlay',
    tone: 'green',
    title: 'Inspect overlay',
    tag: 'on-page',
    text: 'Hover to highlight any element, click to lock the panel. Otherwise Iris stays completely invisible.',
  },
  {
    icon: 'breadcrumb',
    tone: 'yellow',
    title: 'Context breadcrumb',
    tag: 'navigate',
    text: 'App page › hero header › hero-title h1 — each level clickable to re-target or jump to source. No DOM trees.',
  },
  {
    icon: 'css',
    tone: 'red',
    title: 'CSS resolution',
    tag: 'explain',
    text: 'Every rule that styles the element, with file:line. Cascade losers struck through, each line in plain language.',
  },
  {
    icon: 'token',
    tone: 'blue',
    title: 'Token awareness',
    tag: 'tokens',
    text: 'Custom properties resolved to their effective value and definition site — with conflict detection across files.',
  },
  {
    icon: 'structure',
    tone: 'green',
    title: 'Structure redlines',
    tag: 'visual',
    text: 'Box model, parent bounds, siblings and flex/grid gaps drawn straight onto the live page, Figma-style.',
  },
];

const STEPS = [
  { title: 'Install', text: 'One lazy line in vite.config — dev server only, never in your build.' },
  { title: 'Press the key', text: 'The on-page keycap wakes the overlay. Esc puts it back to sleep.', kbd: true },
  { title: 'Hover, then click', text: 'Highlight any element, click to lock its panel of resolved facts.' },
  { title: 'Read or hand off', text: 'See what styles it, jump to your editor, or copy AI context for a precise edit.' },
];

export default function App() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('reveal-ready');
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <nav className="nav">
        <div className="shell nav-inner">
          <a className="nav-logo" href="#top">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <circle cx="12" cy="12" r="3.2" fill="currentColor" />
            </svg>
            Iris
          </a>
          <div className="nav-links">
            <a href="#gap">overview</a>
            <a href="#features">features</a>
            <a href="#how">how it works</a>
            <a href="#install">install</a>
          </div>
          <div className="nav-actions">
            <span className="kbd-row">
              <kbd>⌥</kbd>
              <kbd>I</kbd>
            </span>
            <Button variant="primary">Get started</Button>
          </div>
        </div>
      </nav>

      <main className="shell" id="top">
        <header className="hero">
          <p className="hero-eyebrow">Dev-mode inspector · vite-plugin-iris</p>
          <h1 className="hero-title">
            See your UI.
            <br />
            <span className="it">Find</span> your code.
          </h1>
          <p className="hero-lead">
            Press one key, click any element on your running app, and Iris tells
            you what it is in your codebase — component, file and line, the CSS
            that styles it, the tokens it uses.
          </p>
          <div className="hero-actions">
            <Button variant="primary">Get started</Button>
            <Button variant="ghost">{ICONS.play} Watch the demo</Button>
          </div>
          <p className="hero-meta">
            <kbd>⌥</kbd>
            <kbd>I</kbd>
            <span>to inspect · read-only · dev-only</span>
          </p>
        </header>

        <div className="window" data-reveal aria-hidden="true">
          <div className="window-bar">
            <span className="window-dot" />
            <span className="window-dot" />
            <span className="window-dot" />
            <span className="window-title mono">localhost:5173 — your app</span>
          </div>
          <div className="window-body">
            <div className="canvas-preview">
              <span className="preview-target">
                <span className="preview-tag mono">Button · Button.jsx:3</span>
                <Button variant="primary">Get started</Button>
              </span>
            </div>
            <div className="insp">
              <div className="insp-head">
                <span className="insp-name">&lt;Button&gt;</span>
                <span className="insp-loc">Button.jsx:3</span>
              </div>
              <p className="insp-group-label">color &amp; shape</p>
              <div className="insp-row">
                <span className="label">background</span>
                <span className="value">
                  <span className="insp-swatch" />
                  #1f2023
                </span>
              </div>
              <div className="insp-row">
                <span className="label">radius</span>
                <span className="value">4px</span>
              </div>
              <p className="insp-group-label">type</p>
              <div className="insp-row">
                <span className="label">font</span>
                <span className="value">15px · Geist · 500</span>
              </div>
              <div className="insp-row">
                <span className="label">--color-primary</span>
                <span className="insp-defs">2 defs</span>
              </div>
            </div>
          </div>
        </div>

        <section className="section about" id="gap" data-reveal>
          <div>
            <p className="kicker">the gap</p>
            <Button variant="ghost">Read the concept →</Button>
          </div>
          <p className="about-lead">
            <strong>You can see the result, but you can&rsquo;t find the source.</strong>{' '}
            Iris translates every pixel on screen back to the facts in your
            codebase — which component, which styles, which token, and exactly
            where each is defined.
          </p>
        </section>

        <section className="section" id="features">
          <header className="section-head" data-reveal>
            <p className="kicker">features</p>
            <h2 className="section-title">Everything a pixel can tell you</h2>
          </header>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <Card
                key={f.title}
                title={f.title}
                badge={f.tag}
                tone={f.tone}
                icon={ICONS[f.icon]}
                style={{ '--i': i }}
              >
                <p className="card-text">{f.text}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="section" id="how">
          <header className="section-head" data-reveal>
            <p className="kicker">how it works</p>
            <h2 className="section-title">From pixel to source in four steps</h2>
          </header>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li className="step" key={s.title} data-reveal style={{ '--i': i }}>
                <h3>{s.title}</h3>
                <p>
                  {s.kbd ? (
                    <>
                      <kbd>⌥</kbd> <kbd>I</kbd> {s.text}
                    </>
                  ) : (
                    s.text
                  )}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section">
          <div className="promise" data-reveal>
            <div>
              <span className="stat-num">0 KB</span>
              <p className="stat-sub">added to your production build.</p>
            </div>
            <p className="promise-text">
              <strong>Looks, never touches.</strong> No writes to your source, no
              network calls, no trace in <code>vite build</code> — every fact Iris
              shows is static analysis.
            </p>
            <Button variant="primary">Get started</Button>
          </div>
        </section>

        <section className="section quote" data-reveal>
          <blockquote className="pull">
            Iris doesn&rsquo;t teach designers to write code, and doesn&rsquo;t
            write code for them — it lets designers say what they want,{' '}
            <em>precisely</em>, to an AI that can.
          </blockquote>
          <cite>Iris — product principle</cite>
        </section>

        <section className="section" id="install">
          <div className="install" data-reveal>
            <div>
              <p className="kicker">install</p>
              <h2>One line, dev-only.</h2>
              <p className="muted">
                Add it to vite.config behind a <code>command === 'serve'</code>{' '}
                check — it never touches your build or your deploy.
              </p>
              <span className="install-keys">
                then press <kbd>⌥</kbd> <kbd>I</kbd>
              </span>
            </div>
            <pre className="code mono">
              <code>
                <span className="tok-dim"># dev dependency, loaded lazily</span>
                {'\n'}npm i -D vite-plugin-iris
              </code>
            </pre>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer-inner">
          <div>
            <div className="footer-brand">Iris — see your UI, find your code.</div>
            <p className="footer-note">
              <code>vite-plugin-iris</code> · read-only · dev-mode only
            </p>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#install">Install</a>
            <a href="#top">Back to top ↑</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
