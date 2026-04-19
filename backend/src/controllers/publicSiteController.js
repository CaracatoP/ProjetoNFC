import { successResponse } from '../utils/apiResponse.js';
import { getPublicSiteBySlug, resolveTagToSite } from '../services/publicSiteService.js';
import { subscribeToTenantUpdates } from '../services/tenantRealtimeService.js';

export async function getSiteBySlug(req, res) {
  const payload = await getPublicSiteBySlug({
    slug: req.validated.params.slug,
    host: req.tenantContext?.host,
  });
  return successResponse(res, payload, { resolvedBy: req.tenantContext?.source || 'slug' });
}

export async function getSiteByHost(req, res) {
  const payload = await getPublicSiteBySlug({
    host: req.validated?.query?.host || req.query?.host,
  });
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
