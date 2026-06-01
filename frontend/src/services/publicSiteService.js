import { apiSuccessResponseSchema, publicSitePayloadSchema } from '@shared/schemas/index.js';
import { appConfig } from '@/config/appConfig.js';
import { normalizePublicSiteMedia } from '@/services/mediaNormalizer.js';
import { apiRequest } from './apiClient.js';

const publicSiteResponseSchema = apiSuccessResponseSchema(publicSitePayloadSchema);
const PUBLIC_SITE_CACHE_TTL_MS = 30_000;
const publicSiteCache = new Map();
const inFlightPublicSiteRequests = new Map();
const publicSiteCacheVersions = new Map();

function buildPublicSiteCacheKey(kind, value) {
  return `${kind}:${String(value || '')
    .trim()
    .toLowerCase()}`;
}

function getPublicSiteCacheVersion(cacheKey) {
  return publicSiteCacheVersions.get(cacheKey) || 0;
}

function bumpPublicSiteCacheVersion(cacheKey) {
  publicSiteCacheVersions.set(cacheKey, getPublicSiteCacheVersion(cacheKey) + 1);
}

function buildPublicSiteRequestQuery(options = {}) {
  const params = new URLSearchParams();

  if (options.preview) {
    params.set('preview', '1');
  }

  if (options.cacheBust) {
    params.set('t', String(options.cacheBust));
  }

  if (options.previewToken) {
    params.set('previewToken', String(options.previewToken));
  }

  return params.toString();
}

function shouldBypassPublicCache(options = {}) {
  return Boolean(options.bypassCache || (options.preview && options.previewToken));
}

function isFreshCacheEntry(entry, ttlMs) {
  return Boolean(entry && Date.now() - entry.timestamp < ttlMs);
}

async function requestPublicSite(url, cacheKey, options = {}) {
  const ttlMs = Number.isFinite(options.cacheTtlMs) ? Math.max(0, options.cacheTtlMs) : PUBLIC_SITE_CACHE_TTL_MS;
  const bypassCache = shouldBypassPublicCache(options);
  const requestVersion = getPublicSiteCacheVersion(cacheKey);

  if (!bypassCache) {
    const cachedEntry = publicSiteCache.get(cacheKey);

    if (isFreshCacheEntry(cachedEntry, ttlMs)) {
      return cachedEntry.data;
    }

    const inFlightRequest = inFlightPublicSiteRequests.get(cacheKey);

    if (inFlightRequest) {
      return inFlightRequest;
    }
  }

  const requestOptions = bypassCache
    ? {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    : {};

  const requestPromise = apiRequest(url, requestOptions)
    .then((response) => {
      const parsedResponse = publicSiteResponseSchema.parse(response);
      const normalizedPayload = normalizePublicSiteMedia(parsedResponse.data);
      const payloadWithPreviewContext = {
        ...normalizedPayload,
        previewContext: {
          requested: Boolean(options.preview),
          authorized: Boolean(parsedResponse.meta?.previewAuthorized),
        },
      };

      if (!bypassCache && getPublicSiteCacheVersion(cacheKey) === requestVersion) {
        publicSiteCache.set(cacheKey, {
          data: payloadWithPreviewContext,
          timestamp: Date.now(),
        });
      }

      return payloadWithPreviewContext;
    })
    .finally(() => {
      if (!bypassCache) {
        inFlightPublicSiteRequests.delete(cacheKey);
      }
    });

  if (!bypassCache) {
    inFlightPublicSiteRequests.set(cacheKey, requestPromise);
  }

  return requestPromise;
}

export function resetPublicSiteCache() {
  publicSiteCache.clear();
  inFlightPublicSiteRequests.clear();
  publicSiteCacheVersions.clear();
}

function invalidatePublicSiteCacheKey(kind, value) {
  const cacheKey = buildPublicSiteCacheKey(kind, value);
  publicSiteCache.delete(cacheKey);
  inFlightPublicSiteRequests.delete(cacheKey);
  bumpPublicSiteCacheVersion(cacheKey);
}

export function invalidatePublicSiteCache(target = {}) {
  if (target.slug) {
    invalidatePublicSiteCacheKey('slug', target.slug);
  }

  if (target.host) {
    invalidatePublicSiteCacheKey('host', target.host);
  }

  if (target.domains?.customDomain) {
    invalidatePublicSiteCacheKey('host', target.domains.customDomain);
  }

  if (target.previousSlug) {
    invalidatePublicSiteCacheKey('slug', target.previousSlug);
  }

  if (target.previousDomains?.customDomain) {
    invalidatePublicSiteCacheKey('host', target.previousDomains.customDomain);
  }
}

export async function getPublicSiteBySlug(slug, options = {}) {
  const normalizedSlug = String(slug || '').trim();
  const query = buildPublicSiteRequestQuery(options);
  const requestUrl = `${appConfig.apiBaseUrl}/public/site/${normalizedSlug}${query ? `?${query}` : ''}`;
  return requestPublicSite(requestUrl, buildPublicSiteCacheKey('slug', normalizedSlug), options);
}

export async function getPublicSiteByHost(host, options = {}) {
  const normalizedHost = String(host || '').trim();
  const query = buildPublicSiteRequestQuery(options);
  const baseUrl = `${appConfig.apiBaseUrl}/public/site?host=${encodeURIComponent(normalizedHost)}`;
  const requestUrl = query ? `${baseUrl}&${query}` : baseUrl;
  return requestPublicSite(requestUrl, buildPublicSiteCacheKey('host', normalizedHost), options);
}

export async function resolveNfcTag(tagCode) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/public/tags/${tagCode}/resolve`);
  return response.data;
}

export async function createPublicAppointmentRequest(slug, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/public/site/${slug}/appointment-requests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function createPublicOrder(slug, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/public/site/${slug}/orders`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
}
