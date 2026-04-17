export function PublicSiteLayout({ business, children }) {
  return (
    <div className="public-site">
      <div className="public-site__mesh" aria-hidden="true" />
      <header className="public-site__topbar">
        <span className="public-site__tenant">Slug: /site/{business.slug}</span>
        <span className="public-site__status">{business.status}</span>
      </header>
      <main className="public-site__content">{children}</main>
    </div>
  );
}

