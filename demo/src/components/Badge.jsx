// Keeps `legacy-accent` so the conflicted --color-primary token has a live
// consumer for Iris to detect; `tone` adds an optional pastel spot-color.
const Badge = ({ children, tone }) => (
  <span className={`badge legacy-accent${tone ? ` badge--${tone}` : ''}`}>
    {children}
  </span>
);

export default Badge;
