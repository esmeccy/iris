import Badge from './Badge.jsx';

export default function Card({ title, badge, children }) {
  return (
    <article className="card">
      <header className="card-header">
        <h3 className="card-title">{title}</h3>
        {badge ? <Badge>{badge}</Badge> : null}
      </header>
      <div className="card-body">{children}</div>
    </article>
  );
}
