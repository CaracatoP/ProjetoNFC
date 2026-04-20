import { useEffect } from 'react';
import taplinkMarkUrl from '@/assets/taplink-mark.svg';

function upsertHeadLink(attributes) {
  const selector = Object.entries(attributes)
    .map(([name, value]) => `[${name}="${value}"]`)
    .join('');

  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

export function AppShell({
  eyebrow,
  title,
  description,
  children,
  shellClassName = '',
  heroClassName = '',
  contentClassName = '',
  pageTitle = 'TapLink',
}) {
  useEffect(() => {
    document.title = pageTitle;
    upsertHeadLink({ rel: 'icon' }).setAttribute('href', taplinkMarkUrl);
    upsertHeadLink({ rel: 'alternate icon' }).setAttribute('href', taplinkMarkUrl);
    upsertHeadLink({ rel: 'shortcut icon' }).setAttribute('href', taplinkMarkUrl);
  }, [pageTitle]);

  return (
    <div className={['app-shell', shellClassName].filter(Boolean).join(' ')}>
      <header className={['app-shell__hero', heroClassName].filter(Boolean).join(' ')}>
        <div className="app-shell__brand">
          <img src={taplinkMarkUrl} alt="TapLink" className="app-shell__brand-mark" />
          <div className="app-shell__brand-copy">
            <strong>TapLink</strong>
            <span>Backoffice multi-tenant</span>
          </div>
        </div>
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </header>
      <main className={['app-shell__content', contentClassName].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
