import { normalizeHost } from '../../../shared/utils/tenantIdentity.js';
import { Business } from '../models/Business.js';

function buildExcludedBusinessFilter(excludedBusinessId = null) {
  return excludedBusinessId ? { _id: { $ne: excludedBusinessId } } : {};
}

export async function findBusinessByHost(host) {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost) {
    return null;
  }

  const exactCustomDomainMatch = await Business.findOne({ 'domains.customDomain': normalizedHost }).lean();

  if (exactCustomDomainMatch) {
    return exactCustomDomainMatch;
  }

  const hostParts = normalizedHost.split('.').filter(Boolean);

  if (hostParts.length <= 2) {
    return null;
  }

  return Business.findOne({ 'domains.subdomain': hostParts[0] }).lean();
}

export async function findBusinessBySlugStrict(slug) {
  const normalizedSlug = String(slug || '').trim();

  if (!normalizedSlug) {
    return null;
  }

  return Business.findOne({ slug: normalizedSlug }).lean();
}

export async function findBusinessBySlug(slug) {
  return Business.findOne({ slug }).lean();
}

export async function isBusinessSlugTaken(slug, excludedBusinessId = null) {
  if (!slug) {
    return false;
  }

  return Boolean(
    await Business.exists({
      slug,
      ...buildExcludedBusinessFilter(excludedBusinessId),
    }),
  );
}

export async function isBusinessSubdomainTaken(subdomain, excludedBusinessId = null) {
  if (!subdomain) {
    return false;
  }

  return Boolean(
    await Business.exists({
      'domains.subdomain': subdomain,
      ...buildExcludedBusinessFilter(excludedBusinessId),
    }),
  );
}

export async function isBusinessCustomDomainTaken(customDomain, excludedBusinessId = null) {
  const normalizedCustomDomain = normalizeHost(customDomain);

  if (!normalizedCustomDomain) {
    return false;
  }

  return Boolean(
    await Business.exists({
      'domains.customDomain': normalizedCustomDomain,
      ...buildExcludedBusinessFilter(excludedBusinessId),
    }),
  );
}
