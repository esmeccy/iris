import Badge from './Badge.jsx';

export default function Card({ title, badge, tone, icon, style, children }) {
  return (
    <article className="card" data-reveal style={style}>
      <header className="card-header">
        {icon ? <span className="card-icon">{icon}</span> : <span />}
        {badge ? <Badge tone={tone}>{badge}</Badge> : null}
      </header>
      <h3 className="card-title">{title}</h3>
      <div className="card-body">{children}</div>
    </article>
  );
}
