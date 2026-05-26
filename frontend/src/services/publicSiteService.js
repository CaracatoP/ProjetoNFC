import { apiSuccessResponseSchema, publicSitePayloadSchema } from '@shared/schemas/index.js';
import { appConfig } from '@/config/appConfig.js';
import { normalizePublicSiteMedia } from '@/services/mediaNormalizer.js';
import { apiRequest } from './apiClient.js';

const publicSiteResponseSchema = apiSuccessResponseSchema(publicSitePayloadSchema);
const PUBLIC_SITE_CACHE_TTL_MS = 30_000;
const publicSiteCache = new Map();
const inFlightPublicSiteRequests = new Map();

function buildPublicSiteCacheKey(kind, value) {
  return `${kind}:${String(value || '')
    .trim()
    .toLowerCase()}`;
}

function buildPublicSiteRequestQuery(options = {}) {
  const params = new URLSearchParams();

  if (options.preview) {
    params.set('preview', '1');
  }

  if (options.cacheBust) {
    params.set('t', String(options.cacheBust));
  }

  return params.toString();
}

function shouldBypassPublicCache(options = {}) {
  return Boolean(options.preview || options.bypassCache);
}

function isFreshCacheEntry(entry, ttlMs) {
  return Boolean(entry && Date.now() - entry.timestamp < ttlMs);
}

async function requestPublicSite(url, cacheKey, options = {}) {
  const ttlMs = Number.isFinite(options.cacheTtlMs) ? Math.max(0, options.cacheTtlMs) : PUBLIC_SITE_CACHE_TTL_MS;
  const bypassCache = shouldBypassPublicCache(options);

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

  const requestPromise = apiRequest(url, requestOptions, publicSiteResponseSchema)
    .then((response) => {
      const normalizedPayload = normalizePublicSiteMedia(response.data);

      if (!bypassCache) {
        publicSiteCache.set(cacheKey, {
          data: normalizedPayload,
          timestamp: Date.now(),
        });
      }

      return normalizedPayload;
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
