import { useEffect } from 'react';
import taplinkMarkUrl from '@/assets/taplink-mark.svg';

function upsertHeadLink(rel, attributes = {}) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  element.setAttribute('rel', rel);
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
    upsertHeadLink('icon', { href: taplinkMarkUrl, type: 'image/svg+xml', sizes: 'any' });
    upsertHeadLink('alternate icon', { href: taplinkMarkUrl });
    upsertHeadLink('shortcut icon', { href: taplinkMarkUrl });
    upsertHeadLink('apple-touch-icon', { href: taplinkMarkUrl });
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
