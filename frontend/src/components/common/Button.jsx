export function Button({
  children,
  className = '',
  href,
  target = '_self',
  rel,
  variant = 'primary',
  size = 'md',
  ...props
}) {
  const classes = ['button', `button--${variant}`, `button--${size}`, className].filter(Boolean).join(' ');

  if (href) {
    return (
      <a
        className={classes}
        href={href}
        target={target}
        rel={rel || (target === '_blank' ? 'noreferrer' : undefined)}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
