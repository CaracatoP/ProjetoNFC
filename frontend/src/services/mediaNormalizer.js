import { resolveMediaUrl } from '@/utils/formatters.js';

export function normalizeBusinessMedia(business = {}) {
  return {
    ...business,
    logoUrl: resolveMediaUrl(business.logoUrl),
    bannerUrl: resolveMediaUrl(business.bannerUrl),
    seo: business.seo
      ? {
          ...business.seo,
          imageUrl: resolveMediaUrl(business.seo.imageUrl),
        }
      : business.seo,
  };
}

export function normalizeMediaSections(sections = []) {
  return sections.map((section) => {
    if (section.type !== 'gallery' && section.type !== 'services') {
      return section;
    }

    return {
      ...section,
      items: (section.items || []).map((item) => ({
        ...item,
        imageUrl: item.imageUrl ? resolveMediaUrl(item.imageUrl) : item.imageUrl,
      })),
    };
  });
}

export function normalizeEditorPayload(editor = {}) {
  return {
    ...editor,
    business: normalizeBusinessMedia(editor.business),
    sections: normalizeMediaSections(editor.sections || []),
    modulesData: normalizeModulesDataMedia(editor.modulesData || {}),
  };
}

export function normalizePublicSiteMedia(site = {}) {
  return {
    ...site,
    business: normalizeBusinessMedia(site.business || {}),
    sections: normalizeMediaSections(site.sections || []),
    modulesData: normalizeModulesDataMedia(site.modulesData || {}),
    seo: site.seo
      ? {
          ...site.seo,
          imageUrl: resolveMediaUrl(site.seo.imageUrl),
        }
      : site.seo,
  };
}

export function normalizeModulesDataMedia(modulesData = {}) {
  return {
    ...modulesData,
    professionals: (modulesData.professionals || []).map((professional) => ({
      ...professional,
      avatar: resolveMediaUrl(professional.avatar),
    })),
    products: (modulesData.products || []).map((product) => ({
      ...product,
      image: resolveMediaUrl(product.image),
    })),
  };
}
