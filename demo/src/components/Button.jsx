export default function Button({ variant = 'default', children, ...rest }) {
  return (
    <button className={`button button--${variant}`} type="button" {...rest}>
      {children}
    </button>
  );
}
