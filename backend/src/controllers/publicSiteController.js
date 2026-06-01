import { successResponse } from '../utils/apiResponse.js';
import { getPublicSiteByHost, getPublicSiteBySlug, resolveTagToSite } from '../services/publicSiteService.js';
import { subscribeToTenantUpdates } from '../services/tenantRealtimeService.js';
import { isPreviewTokenValidForBusiness, isPreviewTokenValidForSlug } from '../utils/previewToken.js';

function isPreviewRequest(req) {
  const previewValue = req.query?.preview ?? req.validated?.query?.preview;
  return previewValue === '1' || previewValue === 'true' || previewValue === true;
}

function getPreviewToken(req) {
  return String(req.validated?.query?.previewToken || req.query?.previewToken || '').trim();
}

function buildPreviewMeta(req, business, options = {}) {
  const previewRequested = isPreviewRequest(req);
  const previewToken = getPreviewToken(req);
  const previewAuthorized = previewRequested
    ? Boolean(
        options.slug
          ? isPreviewTokenValidForSlug(previewToken, options.slug) && isPreviewTokenValidForBusiness(previewToken, business)
          : isPreviewTokenValidForBusiness(previewToken, business),
      )
    : false;

  return {
    previewRequested,
    previewAuthorized,
  };
}

function applyPublicSiteCacheHeaders(res, previewMeta) {
  res.setHeader(
    'Cache-Control',
    previewMeta.previewAuthorized
      ? 'no-store'
      : 'public, max-age=30, stale-while-revalidate=120',
  );
}

export async function getSiteBySlug(req, res) {
  const slug = req.validated.params.slug;
  const previewMeta = {
    previewRequested: isPreviewRequest(req),
    previewAuthorized: isPreviewTokenValidForSlug(getPreviewToken(req), slug),
  };
  const payload = await getPublicSiteBySlug(slug, {
    allowInactive: previewMeta.previewAuthorized,
  });
  const resolvedPreviewMeta = buildPreviewMeta(req, payload.business, { slug });
  applyPublicSiteCacheHeaders(res, resolvedPreviewMeta);
  return successResponse(res, payload, {
    resolvedBy: 'slug',
    previewAuthorized: resolvedPreviewMeta.previewAuthorized,
  });
}

export async function getSiteByHost(req, res) {
  const payload = await getPublicSiteByHost(req.validated?.query?.host || req.query?.host);
  const previewMeta = buildPreviewMeta(req, payload.business);
  applyPublicSiteCacheHeaders(res, previewMeta);
  return successResponse(res, payload, {
    resolvedBy: 'host',
    previewAuthorized: previewMeta.previewAuthorized,
  });
}

export async function resolveTag(req, res) {
  const payload = await resolveTagToSite(req.validated.params.tagCode);
  return successResponse(res, payload, { resolvedBy: 'tag' });
}

export function streamTenantUpdates(req, res) {
  const target = req.validated?.query || req.query || {};

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const writeEvent = (eventName, payload) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  res.write('retry: 5000\n\n');
  writeEvent('connected', {
    businessId: target.businessId || '',
    slug: target.slug || '',
    host: target.host || '',
  });

  const unsubscribe = subscribeToTenantUpdates(target, (payload) => {
    writeEvent('tenant_updated', payload);
  });

  const heartbeat = setInterval(() => {
    res.write(`: keepalive ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
}
