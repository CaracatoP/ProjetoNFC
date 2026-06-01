import { resolveMediaUrl } from '@/utils/formatters.js';
import { normalizeBusinessContact } from '@shared/utils/businessContact.js';
import { normalizeBusinessPaymentSettings, normalizeOrderPayment } from '@shared/utils/businessPayment.js';
import {
  buildLegacyDisplayQuantity,
  calculateMeasuredItemTotal,
  normalizeMeasurementUnit,
  normalizeProductMeasurement,
} from '@shared/utils/productMeasurement.js';

export function normalizeBusinessMedia(business = {}) {
  return {
    ...business,
    contact: normalizeBusinessContact(business.contact || {}),
    paymentSettings: normalizeBusinessPaymentSettings(business.paymentSettings || {}, business.contact?.pix || {}),
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
      ...normalizeProductMeasurement(product),
      image: resolveMediaUrl(product.image),
    })),
    orders: (modulesData.orders || []).map((order) => ({
      ...order,
      payment: normalizeOrderPayment(order.payment || {}, Number(order.total || 0)),
      items: (order.items || []).map((item) => {
        const measurementUnit = normalizeMeasurementUnit(item.measurementUnit);
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unitPrice || 0);

        return {
          ...item,
          measurementUnit,
          displayQuantity:
            String(item.displayQuantity || '').trim() ||
            buildLegacyDisplayQuantity(quantity, measurementUnit),
          itemTotal: Number.isFinite(Number(item.itemTotal))
            ? Number(Number(item.itemTotal).toFixed(2))
            : calculateMeasuredItemTotal(unitPrice, quantity),
        };
      }),
    })),
  };
}
