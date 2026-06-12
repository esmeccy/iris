import Button from './components/Button.jsx';
import Card from './components/Card.jsx';

const Section = ({ title, children }) => (
  <section className="section">
    <h2 className="section-title">{title}</h2>
    <div className="section-body">{children}</div>
  </section>
);

export default function App() {
  return (
    <main className="page">
      <header className="hero">
        <h1 className="hero-title">Iris Demo</h1>
        <p className="hero-subtitle">
          A test bed for the element inspector: nested components, three CSS
          files, and one deliberate token conflict.
        </p>
        <Button variant="primary">Get started</Button>
      </header>

      <Section title="Features">
        <Card title="Click to source" badge="new">
          <p className="card-text">
            Every native element carries its component and source location.
          </p>
          <Button>Learn more</Button>
        </Card>

        <Card title="Token aware" badge="soon">
          <p className="card-text">
            CSS custom properties are treated as design tokens.
          </p>
          <Button variant="ghost">Preview</Button>
        </Card>

        <Card title="Legacy styles">
          <p className="card-text">
            Some styles here come from legacy.css on purpose.
          </p>
          <Button variant="primary">Inspect</Button>
        </Card>
      </Section>
    </main>
  );
}
