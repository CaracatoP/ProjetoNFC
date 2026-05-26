import { normalizeHost } from '../../../shared/utils/tenantIdentity.js';
import { Business } from '../models/Business.js';

const PUBLIC_BUSINESS_PROJECTION = {
  slug: 1,
  name: 1,
  legalName: 1,
  description: 1,
  logoUrl: 1,
  bannerUrl: 1,
  badge: 1,
  status: 1,
  domains: 1,
  address: 1,
  hours: 1,
  rating: 1,
  contact: 1,
  seo: 1,
};

function buildExcludedBusinessFilter(excludedBusinessId = null) {
  return excludedBusinessId ? { _id: { $ne: excludedBusinessId } } : {};
}

function findLeanBusiness(filter, projection = null) {
  return Business.findOne(filter, projection).lean();
}

export async function findBusinessByHost(host, projection = null) {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost) {
    return null;
  }

  const exactCustomDomainMatch = await findLeanBusiness(
    { 'domains.customDomain': normalizedHost },
    projection,
  );

  if (exactCustomDomainMatch) {
    return exactCustomDomainMatch;
  }

  const hostParts = normalizedHost.split('.').filter(Boolean);

  if (hostParts.length <= 2) {
    return null;
  }

  return findLeanBusiness({ 'domains.subdomain': hostParts[0] }, projection);
}

export async function findBusinessBySlugStrict(slug, projection = null) {
  const normalizedSlug = String(slug || '').trim();

  if (!normalizedSlug) {
    return null;
  }

  return findLeanBusiness({ slug: normalizedSlug }, projection);
}

export async function findBusinessBySlug(slug, projection = null) {
  return findLeanBusiness({ slug }, projection);
}

export async function findPublicBusinessByHost(host) {
  return findBusinessByHost(host, PUBLIC_BUSINESS_PROJECTION);
}

export async function findPublicBusinessBySlugStrict(slug) {
  return findBusinessBySlugStrict(slug, PUBLIC_BUSINESS_PROJECTION);
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
