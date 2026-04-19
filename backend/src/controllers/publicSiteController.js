import { successResponse } from '../utils/apiResponse.js';
import { getPublicSiteBySlug, resolveTagToSite } from '../services/publicSiteService.js';

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
