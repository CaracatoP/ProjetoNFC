export function AppShell({
  eyebrow,
  title,
  description,
  children,
  shellClassName = '',
  heroClassName = '',
  contentClassName = '',
}) {
  return (
    <div className={['app-shell', shellClassName].filter(Boolean).join(' ')}>
      <header className={['app-shell__hero', heroClassName].filter(Boolean).join(' ')}>
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </header>
      <main className={['app-shell__content', contentClassName].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
