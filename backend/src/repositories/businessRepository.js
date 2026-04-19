import { BUSINESS_STATUS } from '../../../shared/constants/index.js';
import { Business } from '../models/Business.js';

function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split(':')[0];
}

function buildExcludedBusinessFilter(excludedBusinessId = null) {
  return excludedBusinessId ? { _id: { $ne: excludedBusinessId } } : {};
}

function buildTenantReferenceOrConditions(reference = {}) {
  const slug = String(reference.slug || '').trim();
  const host = normalizeHost(reference.host);
  const orConditions = [];

  if (slug) {
    orConditions.push({ slug });
  }

  if (host) {
    orConditions.push({ 'domains.customDomain': host });

    const hostParts = host.split('.').filter(Boolean);
    if (hostParts.length > 2) {
      orConditions.push({ 'domains.subdomain': hostParts[0] });
    }
  }

  return orConditions;
}

function buildPublicStatusFilter() {
  return {
    $in: [BUSINESS_STATUS.ACTIVE, BUSINESS_STATUS.DRAFT],
  };
}

export async function findBusinessByTenantContext(reference = {}) {
  const orConditions = buildTenantReferenceOrConditions(reference);

  if (!orConditions.length) {
    return null;
  }

  return Business.findOne({ $or: orConditions }).lean();
}

export async function findPublicBusinessByTenantContext(reference = {}) {
  const orConditions = buildTenantReferenceOrConditions(reference);

  if (!orConditions.length) {
    return null;
  }

  return Business.findOne({
    status: buildPublicStatusFilter(),
    $or: orConditions,
  }).lean();
}

export async function findPublicBusinessBySlug(slug) {
  return findPublicBusinessByTenantContext({ slug });
}

export async function findBusinessBySlug(slug) {
  return Business.findOne({ slug }).lean();
}

export async function findBusinessById(id) {
  return Business.findById(id).lean();
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
