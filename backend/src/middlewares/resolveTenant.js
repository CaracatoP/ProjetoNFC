export function resolveTenant(req, _res, next) {
  const host = (req.headers.host || '').split(':')[0];
  const hostParts = host.split('.').filter(Boolean);
  const headerSlug = req.headers['x-tenant-slug'];
  let slug = req.params.slug || headerSlug;
  let source = req.params.slug ? 'path' : headerSlug ? 'header' : 'unknown';

  if (!slug && hostParts.length > 2 && !['localhost', '127'].includes(hostParts[0])) {
    slug = hostParts[0];
    source = 'host';
  }

  req.tenantContext = {
    slug: slug || null,
    host,
    source,
  };

  next();
}
