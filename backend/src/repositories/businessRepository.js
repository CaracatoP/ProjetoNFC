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

function buildPublicStatusFilter() {
  return {
    $in: [BUSINESS_STATUS.ACTIVE, BUSINESS_STATUS.DRAFT],
  };
}

export async function findPublicBusinessByTenantContext(reference = {}) {
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
  const query = {
    slug,
  };

  if (excludedBusinessId) {
    query._id = { $ne: excludedBusinessId };
  }

  return Boolean(await Business.exists(query));
}
