import { AppError } from '../utils/appError.js';
import { buildDefaultTenantSetup } from '../utils/adminDefaults.js';
import {
  createBusinessRecord,
  deleteBusinessGraphRecords,
  findBusinessGraphForAdmin,
  getAnalyticsCountsByBusinessIds,
  getBusinessAnalyticsSummary,
  listBusinessesForAdmin,
  replaceLinkRecords,
  replaceSectionRecords,
  updateBusinessRecord,
  upsertNfcTagRecord,
  upsertThemeRecord,
} from '../repositories/adminRepository.js';

function normalizeHours(hours = []) {
  return hours
    .filter((hour) => hour?.label || hour?.value)
    .map((hour, index) => ({
      id: hour.id || `hour-${index + 1}`,
      label: String(hour.label || '').trim(),
      value: String(hour.value || '').trim(),
    }))
    .filter((hour) => hour.label && hour.value);
}

function normalizeBusinessPayload(payload = {}) {
  return {
    name: String(payload.name || '').trim(),
    legalName: String(payload.legalName || '').trim(),
    slug: String(payload.slug || '').trim(),
    description: String(payload.description || '').trim(),
    logoUrl: String(payload.logoUrl || '').trim(),
    bannerUrl: String(payload.bannerUrl || '').trim(),
    badge: String(payload.badge || '').trim(),
    status: String(payload.status || 'draft').trim(),
    rating: String(payload.rating || '').trim(),
    address: {
      display: String(payload.address?.display || '').trim(),
      mapUrl: String(payload.address?.mapUrl || '').trim(),
      embedUrl: String(payload.address?.embedUrl || '').trim(),
      latitude: payload.address?.latitude,
      longitude: payload.address?.longitude,
    },
    hours: normalizeHours(payload.hours),
    contact: {
      whatsapp: String(payload.contact?.whatsapp || '').trim(),
      phone: String(payload.contact?.phone || '').trim(),
      email: String(payload.contact?.email || '').trim(),
      wifi: payload.contact?.wifi?.ssid || payload.contact?.wifi?.password
        ? {
            ssid: String(payload.contact?.wifi?.ssid || '').trim(),
            password: String(payload.contact?.wifi?.password || '').trim(),
            security: String(payload.contact?.wifi?.security || 'WPA').trim(),
            title: String(payload.contact?.wifi?.title || '').trim(),
            description: String(payload.contact?.wifi?.description || '').trim(),
          }
        : undefined,
      pix: payload.contact?.pix?.key
        ? {
            keyType: String(payload.contact?.pix?.keyType || '').trim(),
            key: String(payload.contact?.pix?.key || '').trim(),
            receiverName: String(payload.contact?.pix?.receiverName || '').trim(),
            city: String(payload.contact?.pix?.city || '').trim(),
            description: String(payload.contact?.pix?.description || '').trim(),
            actionLabel: String(payload.contact?.pix?.actionLabel || '').trim(),
            actionDescription: String(payload.contact?.pix?.actionDescription || '').trim(),
          }
        : undefined,
    },
    seo: {
      title: String(payload.seo?.title || '').trim(),
      description: String(payload.seo?.description || '').trim(),
      imageUrl: String(payload.seo?.imageUrl || '').trim(),
    },
  };
}

function normalizeThemePayload(payload = {}) {
  return {
    colors: payload.colors || {},
    typography: payload.typography || {},
    spacing: payload.spacing || {},
    radius: payload.radius || {},
    layout: payload.layout || {},
    buttons: payload.buttons || {},
    customCss: String(payload.customCss || ''),
  };
}

function normalizeLinksPayload(links = []) {
  return links
    .map((link, index) => ({
      type: String(link.type || 'external'),
      group: String(link.group || 'primary'),
      label: String(link.label || '').trim(),
      subtitle: String(link.subtitle || '').trim(),
      icon: String(link.icon || '').trim(),
      url: String(link.url || '').trim(),
      value: String(link.value || '').trim(),
      visible: link.visible !== false,
      order: Number(link.order ?? index + 1),
      target: String(link.target || '_blank'),
      metadata: link.metadata || {},
    }))
    .filter((link) => link.label);
}

function normalizeSectionItems(items = []) {
  return items
    .map((item, index) => ({
      ...item,
      id: item.id || `item-${index + 1}`,
    }))
    .filter(Boolean);
}

function normalizeSectionsPayload(sections = []) {
  return sections
    .map((section, index) => ({
      key: String(section.key || '').trim(),
      type: String(section.type || '').trim(),
      title: String(section.title || '').trim(),
      description: String(section.description || '').trim(),
      order: Number(section.order ?? index + 1),
      visible: section.visible !== false,
      variant: String(section.variant || '').trim(),
      settings: section.settings || {},
      items: normalizeSectionItems(section.items),
    }))
    .filter((section) => section.key && section.type);
}

function normalizeTagPayload(tag = {}) {
  return tag?.code
    ? {
        code: String(tag.code || '').trim(),
        status: String(tag.status || 'active').trim(),
      }
    : null;
}

function serializeSummary(business, analyticsMap) {
  const summary = analyticsMap.get(String(business._id)) || {};

  return {
    id: String(business._id),
    name: business.name,
    slug: business.slug,
    status: business.status,
    logoUrl: business.logoUrl,
    description: business.description,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
    analytics: {
      totalEvents: summary.totalEvents || 0,
      pageViews: summary.pageViews || 0,
      linkClicks: summary.linkClicks || 0,
      lastEventAt: summary.lastEventAt || null,
    },
  };
}

async function hydrateEditorResponse(businessId) {
  const graph = await findBusinessGraphForAdmin(businessId);

  if (!graph.business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  const analytics = await getBusinessAnalyticsSummary(businessId);

  return {
    business: {
      id: String(graph.business._id),
      ...normalizeBusinessPayload(graph.business),
    },
    theme: graph.theme ? normalizeThemePayload(graph.theme) : buildDefaultTenantSetup(graph.business).theme,
    links: normalizeLinksPayload(graph.links),
    sections: normalizeSectionsPayload(graph.sections),
    nfcTag: graph.nfcTag
      ? {
          code: graph.nfcTag.code,
          status: graph.nfcTag.status,
          lastResolvedAt: graph.nfcTag.lastResolvedAt || null,
        }
      : null,
    analytics: {
      totalEvents: analytics.totals.totalEvents || 0,
      last7DaysEvents: analytics.totals.last7DaysEvents || 0,
      byEventType: analytics.byEventType.map((item) => ({
        eventType: item._id,
        count: item.count,
      })),
      recentEvents: analytics.recentEvents.map((event) => ({
        id: String(event._id),
        eventType: event.eventType,
        sectionType: event.sectionType,
        targetType: event.targetType,
        targetLabel: event.targetLabel,
        occurredAt: event.occurredAt,
      })),
    },
  };
}

export async function listAdminBusinesses() {
  const businesses = await listBusinessesForAdmin();
  const analytics = await getAnalyticsCountsByBusinessIds(businesses.map((business) => String(business._id)));
  const analyticsMap = new Map(analytics.map((item) => [String(item._id), item]));

  return businesses.map((business) => serializeSummary(business, analyticsMap));
}

export async function getAdminBusinessEditor(businessId) {
  return hydrateEditorResponse(businessId);
}

export async function createAdminBusiness(input) {
  const defaults = buildDefaultTenantSetup(input.business || input);
  const businessPayload = normalizeBusinessPayload({
    ...defaults.business,
    ...(input.business || input),
  });
  const business = await createBusinessRecord(businessPayload);

  await upsertThemeRecord(business._id, normalizeThemePayload(input.theme || defaults.theme));
  await replaceLinkRecords(business._id, normalizeLinksPayload(input.links || defaults.links));
  await replaceSectionRecords(business._id, normalizeSectionsPayload(input.sections || defaults.sections));
  await upsertNfcTagRecord(business._id, normalizeTagPayload(input.nfcTag || defaults.nfcTag));

  return hydrateEditorResponse(String(business._id));
}

export async function updateAdminBusiness(businessId, input) {
  const businessPayload = normalizeBusinessPayload(input.business || {});
  const business = await updateBusinessRecord(businessId, businessPayload);

  if (!business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  await Promise.all([
    upsertThemeRecord(businessId, normalizeThemePayload(input.theme || {})),
    replaceLinkRecords(businessId, normalizeLinksPayload(input.links || [])),
    replaceSectionRecords(businessId, normalizeSectionsPayload(input.sections || [])),
    upsertNfcTagRecord(businessId, normalizeTagPayload(input.nfcTag || null)),
  ]);

  return hydrateEditorResponse(businessId);
}

export async function deleteAdminBusiness(businessId) {
  const existing = await findBusinessGraphForAdmin(businessId);

  if (!existing.business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  await deleteBusinessGraphRecords(businessId);

  return {
    deleted: true,
    businessId,
  };
}
