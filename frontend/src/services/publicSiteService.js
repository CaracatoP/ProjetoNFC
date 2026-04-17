import { apiSuccessResponseSchema, publicSitePayloadSchema } from '@shared/schemas/index.js';
import { appConfig } from '@/config/appConfig.js';
import { apiRequest } from './apiClient.js';
import { getDemoSiteFallback } from './demoSiteFallback.js';

const publicSiteResponseSchema = apiSuccessResponseSchema(publicSitePayloadSchema);

export async function getPublicSiteBySlug(slug) {
  try {
    const response = await apiRequest(
      `${appConfig.apiBaseUrl}/public/site/${slug}`,
      {},
      publicSiteResponseSchema,
    );
    return response.data;
  } catch (error) {
    if (slug === appConfig.demoSiteSlug) {
      console.warn('API indisponível; usando payload demo local para o tenant de exemplo.', error);
      return getDemoSiteFallback();
    }

    throw error;
  }
}

export async function resolveNfcTag(tagCode) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/public/tags/${tagCode}/resolve`);
  return response.data;
}
