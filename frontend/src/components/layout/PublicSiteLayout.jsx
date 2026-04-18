export function PublicSiteLayout({ children }) {
  return (
    <div className="public-site">
      <div className="public-site__mesh" aria-hidden="true" />
      <main className="public-site__content">{children}</main>
    </div>
  );
}
