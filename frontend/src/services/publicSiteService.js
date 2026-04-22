import { apiSuccessResponseSchema, publicSitePayloadSchema } from '@shared/schemas/index.js';
import { appConfig } from '@/config/appConfig.js';
import { normalizePublicSiteMedia } from '@/services/mediaNormalizer.js';
import { apiRequest } from './apiClient.js';

const publicSiteResponseSchema = apiSuccessResponseSchema(publicSitePayloadSchema);

export async function getPublicSiteBySlug(slug) {
  const response = await apiRequest(
    `${appConfig.apiBaseUrl}/public/site/${slug}`,
    {},
    publicSiteResponseSchema,
  );
  return normalizePublicSiteMedia(response.data);
}

export async function getPublicSiteByHost(host) {
  const response = await apiRequest(
    `${appConfig.apiBaseUrl}/public/site?host=${encodeURIComponent(host)}`,
    {},
    publicSiteResponseSchema,
  );
  return normalizePublicSiteMedia(response.data);
}

export async function resolveNfcTag(tagCode) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/public/tags/${tagCode}/resolve`);
  return response.data;
}
