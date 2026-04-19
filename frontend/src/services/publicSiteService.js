import { apiSuccessResponseSchema, publicSitePayloadSchema } from '@shared/schemas/index.js';
import { appConfig } from '@/config/appConfig.js';
import { apiRequest } from './apiClient.js';
import { resolveMediaUrl } from '@/utils/formatters.js';

const publicSiteResponseSchema = apiSuccessResponseSchema(publicSitePayloadSchema);

function normalizePublicSiteMedia(site = {}) {
  return {
    ...site,
    business: {
      ...(site.business || {}),
      logoUrl: resolveMediaUrl(site.business?.logoUrl),
      bannerUrl: resolveMediaUrl(site.business?.bannerUrl),
      seo: site.business?.seo
        ? {
            ...site.business.seo,
            imageUrl: resolveMediaUrl(site.business.seo.imageUrl),
          }
        : site.business?.seo,
    },
    sections: (site.sections || []).map((section) => {
      if (section.type !== 'gallery') {
        return section;
      }

      return {
        ...section,
        items: (section.items || []).map((item) => ({
          ...item,
          imageUrl: resolveMediaUrl(item.imageUrl),
        })),
      };
    }),
    seo: site.seo
      ? {
          ...site.seo,
          imageUrl: resolveMediaUrl(site.seo.imageUrl),
        }
      : site.seo,
  };
}

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
