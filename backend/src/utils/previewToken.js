import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const PREVIEW_TOKEN_ISSUER = 'taplink-preview';
const PREVIEW_TOKEN_AUDIENCE = 'public-site-preview';

function assertPreviewTokenSecret() {
  if (String(env.previewTokenSecret || '').trim()) {
    return;
  }

  throw new Error('PREVIEW_TOKEN_SECRET precisa estar configurado para emitir preview tokens');
}

function normalizeBusinessId(business) {
  if (typeof business === 'string' || typeof business === 'number') {
    return String(business).trim();
  }

  return String(business?._id || business?.id || '').trim();
}

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function verifyPreviewToken(token) {
  if (!String(token || '').trim()) {
    return null;
  }

  if (!String(env.previewTokenSecret || '').trim()) {
    return null;
  }

  try {
    return jwt.verify(String(token || ''), env.previewTokenSecret, {
      issuer: PREVIEW_TOKEN_ISSUER,
      audience: PREVIEW_TOKEN_AUDIENCE,
    });
  } catch (_error) {
    return null;
  }
}

export function createPreviewToken(adminUser, business) {
  assertPreviewTokenSecret();

  const businessId = normalizeBusinessId(business);
  const slug = normalizeSlug(business?.slug);
  const token = jwt.sign(
    {
      sub: String(adminUser?.id || ''),
      roleLevel: Number(adminUser?.roleLevel ?? 99),
      businessId,
      slug,
    },
    env.previewTokenSecret,
    {
      issuer: PREVIEW_TOKEN_ISSUER,
      audience: PREVIEW_TOKEN_AUDIENCE,
      expiresIn: `${env.previewTokenTtlMinutes}m`,
    },
  );

  const decoded = jwt.decode(token);
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : '';

  return {
    token,
    expiresAt,
    businessId,
    slug,
  };
}

export function isPreviewTokenValidForSlug(token, slug) {
  const payload = verifyPreviewToken(token);

  if (!payload || Number(payload.roleLevel ?? 99) > 1) {
    return false;
  }

  return normalizeSlug(payload.slug) === normalizeSlug(slug);
}

export function isPreviewTokenValidForBusiness(token, business) {
  const payload = verifyPreviewToken(token);

  if (!payload || Number(payload.roleLevel ?? 99) > 1) {
    return false;
  }

  return (
    normalizeBusinessId(payload.businessId) === normalizeBusinessId(business) &&
    normalizeSlug(payload.slug) === normalizeSlug(business?.slug)
  );
}
