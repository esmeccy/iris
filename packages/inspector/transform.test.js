import { describe, expect, it } from 'vitest';
import { tagJsxSource } from './index.js';

const FIXTURE_PATH = 'src/Fixture.jsx';

const fixture = `import Button from './Button.jsx';

function Card({ children }) {
  return <div className="card">{children}</div>;
}

const Badge = ({ children }) => <span className="badge">{children}</span>;

export default function App() {
  return (
    <main>
      <Card>
        <Button label="go" />
      </Card>
      <Badge>new</Badge>
    </main>
  );
}
`;

describe('tagJsxSource', () => {
  const result = tagJsxSource(fixture, FIXTURE_PATH);

  it('tags native elements with source path and line number', () => {
    expect(result.code).toContain('<div data-devlens-source="src/Fixture.jsx:4"');
    expect(result.code).toContain('<span data-devlens-source="src/Fixture.jsx:7"');
    expect(result.code).toContain('<main data-devlens-source="src/Fixture.jsx:11"');
  });

  it('resolves the immediate enclosing component', () => {
    expect(result.code).toContain(
      '<div data-devlens-source="src/Fixture.jsx:4" data-devlens-component="Card"',
    );
    expect(result.code).toContain(
      '<span data-devlens-source="src/Fixture.jsx:7" data-devlens-component="Badge"',
    );
    expect(result.code).toContain(
      '<main data-devlens-source="src/Fixture.jsx:11" data-devlens-component="App"',
    );
  });

  it('leaves capitalized component usages untouched', () => {
    expect(result.code).not.toMatch(/<Card data-devlens/);
    expect(result.code).not.toMatch(/<Button data-devlens/);
    expect(result.code).not.toMatch(/<Badge data-devlens/);
  });

  it('keeps the rest of the source byte-identical', () => {
    const stripped = result.code.replace(
      / data-devlens-source="[^"]*" data-devlens-component="[^"]*"/g,
      '',
    );
    expect(stripped).toBe(fixture);
  });

  it('returns null when there is nothing to tag', () => {
    expect(tagJsxSource('export const x = 1;\n', FIXTURE_PATH)).toBeNull();
  });

  it('emits a source map for the insertions', () => {
    expect(result.map).toBeTruthy();
    expect(result.map.mappings.length).toBeGreaterThan(0);
  });
});
