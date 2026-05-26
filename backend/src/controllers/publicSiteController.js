import { successResponse } from '../utils/apiResponse.js';
import { getPublicSiteByHost, getPublicSiteBySlug, resolveTagToSite } from '../services/publicSiteService.js';
import { subscribeToTenantUpdates } from '../services/tenantRealtimeService.js';

function isPreviewRequest(req) {
  const previewValue = req.query?.preview ?? req.validated?.query?.preview;
  return previewValue === '1' || previewValue === 'true' || previewValue === true;
}

function applyPublicSiteCacheHeaders(req, res) {
  res.setHeader(
    'Cache-Control',
    isPreviewRequest(req)
      ? 'no-store'
      : 'public, max-age=30, stale-while-revalidate=120',
  );
}

export async function getSiteBySlug(req, res) {
  const payload = await getPublicSiteBySlug(req.validated.params.slug);
  applyPublicSiteCacheHeaders(req, res);
  return successResponse(res, payload, { resolvedBy: 'slug' });
}

export async function getSiteByHost(req, res) {
  const payload = await getPublicSiteByHost(req.validated?.query?.host || req.query?.host);
  applyPublicSiteCacheHeaders(req, res);
  return successResponse(res, payload, { resolvedBy: 'host' });
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
