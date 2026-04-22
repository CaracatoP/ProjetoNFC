import { AppError } from '../utils/appError.js';
import {
  buildDefaultTenantSetup,
  buildManagedPrimaryLinks,
  normalizeCreatorSignatureCtaSection,
} from '../utils/adminDefaults.js';
import { env } from '../config/env.js';
import {
  appendBusinessHistoryEntries,
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
import {
  isBusinessCustomDomainTaken,
  isBusinessSlugTaken,
  isBusinessSubdomainTaken,
} from '../repositories/businessRepository.js';
import { ensureDefaultSubscriptionForBusiness } from './billingService.js';
import { publishTenantUpdated } from './tenantRealtimeService.js';

function normalizeCoordinate(value) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeOptionalValue(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeHost(value) {
  return normalizeOptionalValue(value)
    ?.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

const CANONICAL_SECTION_TYPES_BY_KEY = {
  'hero-main': 'hero',
  'quick-actions': 'links',
  services: 'services',
  contact: 'contact',
  gallery: 'gallery',
  about: 'custom',
  pix: 'pix',
  cta: 'cta',
};

function getCanonicalSectionType(key, fallbackType) {
  return CANONICAL_SECTION_TYPES_BY_KEY[key] || fallbackType;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeHistoryValue(value) {
  if (value === undefined) {
    return '';
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeHistoryValue(item));
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = normalizeHistoryValue(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function flattenHistorySnapshot(snapshot, prefix = '') {
  const entries = new Map();

  function visit(currentValue, path) {
    if (currentValue === undefined) {
      return;
    }

    if (Array.isArray(currentValue)) {
      if (!currentValue.length) {
        entries.set(path, []);
        return;
      }

      currentValue.forEach((item, index) => visit(item, path ? `${path}[${index}]` : `[${index}]`));
      return;
    }

    if (isPlainObject(currentValue)) {
      const keys = Object.keys(currentValue).sort();

      if (!keys.length && path) {
        entries.set(path, {});
        return;
      }

      keys.forEach((key) => visit(currentValue[key], path ? `${path}.${key}` : key));
      return;
    }

    entries.set(path, normalizeHistoryValue(currentValue));
  }

  visit(snapshot, prefix);
  return entries;
}

function areHistoryValuesEqual(previousValue, nextValue) {
  return JSON.stringify(previousValue) === JSON.stringify(nextValue);
}

function buildHistoryEntries(previousSnapshot, nextSnapshot, changedAt = new Date()) {
  const previousEntries = flattenHistorySnapshot(previousSnapshot);
  const nextEntries = flattenHistorySnapshot(nextSnapshot);
  const paths = new Set([...previousEntries.keys(), ...nextEntries.keys()]);

  return [...paths]
    .sort((first, second) => first.localeCompare(second))
    .reduce((historyEntries, path) => {
      const previousValue = previousEntries.get(path);
      const nextValue = nextEntries.get(path);

      if (areHistoryValuesEqual(previousValue, nextValue)) {
        return historyEntries;
      }

      historyEntries.push({
        field: path,
        oldValue: previousValue,
        newValue: nextValue,
        changedAt,
      });

      return historyEntries;
    }, []);
}

function buildBusinessPublicUrl(business = {}) {
  const publicSiteBaseUrl = String(env.publicSiteBaseUrl || '').trim().replace(/\/$/, '');

  if (business?.domains?.customDomain) {
    return `https://${business.domains.customDomain}`;
  }

  if (business?.domains?.subdomain) {
    try {
      const baseUrl = new URL(publicSiteBaseUrl);
      return `${baseUrl.protocol}//${business.domains.subdomain}.${baseUrl.host}`;
    } catch {
      // Fall through to slug URL when the environment URL is not parseable.
    }
  }

  return `${publicSiteBaseUrl}/site/${business.slug}`;
}

function publishBusinessRealtimeUpdate(editor, context = {}) {
  publishTenantUpdated({
    operation: context.operation || 'updated',
    businessId: editor?.business?.id,
    slug: editor?.business?.slug,
    previousSlug: context.previousSlug,
    status: editor?.business?.status,
    publicUrl: editor?.business?.publicUrl,
    domains: editor?.business?.domains,
    previousDomains: context.previousDomains,
  });
}

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
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  const seoTitle = String(payload.seo?.title || '').trim() || (name ? `${name} | Pagina NFC` : '');
  const seoDescription =
    String(payload.seo?.description || '').trim() || description || (name ? `Pagina NFC oficial de ${name}.` : '');

  return {
    name,
    legalName: String(payload.legalName || '').trim(),
    slug: String(payload.slug || '').trim(),
    description,
    logoUrl: String(payload.logoUrl || '').trim(),
    logoPublicId: String(payload.logoPublicId || '').trim(),
    bannerUrl: String(payload.bannerUrl || '').trim(),
    bannerPublicId: String(payload.bannerPublicId || '').trim(),
    badge: String(payload.badge || '').trim(),
    status: String(payload.status || 'draft').trim(),
    rating: String(payload.rating || '').trim(),
    domains: {
      subdomain: normalizeOptionalValue(payload.domains?.subdomain)?.toLowerCase(),
      customDomain: normalizeHost(payload.domains?.customDomain),
    },
    address: {
      display: String(payload.address?.display || '').trim(),
      mapUrl: String(payload.address?.mapUrl || '').trim(),
      embedUrl: String(payload.address?.embedUrl || '').trim(),
      latitude: normalizeCoordinate(payload.address?.latitude),
      longitude: normalizeCoordinate(payload.address?.longitude),
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
      title: seoTitle,
      description: seoDescription,
      imageUrl: String(payload.seo?.imageUrl || '').trim(),
      imagePublicId: String(payload.seo?.imagePublicId || '').trim(),
    },
  };
}

async function assertBusinessSlugAvailable(slug, excludedBusinessId = null) {
  if (!slug) {
    return;
  }

  const slugAlreadyTaken = await isBusinessSlugTaken(slug, excludedBusinessId);

  if (slugAlreadyTaken) {
    throw new AppError('Este slug ja esta em uso por outro tenant', 409, 'business_slug_conflict', [
      { path: 'business.slug', message: 'Este slug ja esta em uso por outro tenant' },
    ]);
  }
}

async function assertBusinessDomainsAvailable(domains = {}, excludedBusinessId = null) {
  const subdomain = normalizeOptionalValue(domains.subdomain)?.toLowerCase();
  const customDomain = normalizeHost(domains.customDomain);
  const reservedSubdomains = new Set(['www', 'api']);

  if (subdomain && reservedSubdomains.has(subdomain)) {
    throw new AppError(
      'Este subdominio esta reservado e nao pode ser usado por um tenant',
      409,
      'business_subdomain_reserved',
      [{ path: 'business.domains.subdomain', message: 'Escolha outro subdominio para este tenant' }],
    );
  }

  if (subdomain) {
    const subdomainAlreadyTaken = await isBusinessSubdomainTaken(subdomain, excludedBusinessId);

    if (subdomainAlreadyTaken) {
      throw new AppError(
        'Este subdominio ja esta em uso por outro tenant',
        409,
        'business_subdomain_conflict',
        [{ path: 'business.domains.subdomain', message: 'Este subdominio ja esta em uso por outro tenant' }],
      );
    }
  }

  if (customDomain) {
    const primaryPublicHost = normalizeHost(env.publicSiteBaseUrl);

    if (primaryPublicHost && customDomain === primaryPublicHost) {
      throw new AppError(
        'Este dominio esta reservado como dominio principal da operacao',
        409,
        'business_custom_domain_reserved',
        [{ path: 'business.domains.customDomain', message: 'Escolha outro dominio customizado para o tenant' }],
      );
    }

    const customDomainAlreadyTaken = await isBusinessCustomDomainTaken(customDomain, excludedBusinessId);

    if (customDomainAlreadyTaken) {
      throw new AppError(
        'Este dominio customizado ja esta em uso por outro tenant',
        409,
        'business_custom_domain_conflict',
        [{ path: 'business.domains.customDomain', message: 'Este dominio customizado ja esta em uso por outro tenant' }],
      );
    }
  }
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

function isManagedLinkMatch(link, action) {
  const url = String(link?.url || '').toLowerCase();
  const icon = String(link?.icon || '').toLowerCase();
  const metadataAction = String(link?.metadata?.action || '').toLowerCase();
  const type = String(link?.type || '').toLowerCase();

  switch (action) {
    case 'whatsapp':
      return metadataAction === action || icon === 'whatsapp' || url.startsWith('https://wa.me/');
    case 'phone':
      return metadataAction === action || icon === 'phone' || url.startsWith('tel:');
    case 'email':
      return metadataAction === action || icon === 'mail' || url.startsWith('mailto:');
    case 'wifi':
      return metadataAction === action || type === 'wifi';
    case 'pix':
      return metadataAction === action || type === 'pix';
    default:
      return false;
  }
}

function synchronizeManagedLinks(links = [], business = {}) {
  const managedLinks = buildManagedPrimaryLinks(business);
  const managedActions = managedLinks
    .map((link) => String(link.metadata?.action || '').toLowerCase())
    .filter(Boolean);

  const otherLinks = links.filter(
    (link) =>
      link.group !== 'primary' ||
      !managedActions.some((action) => isManagedLinkMatch(link, action)),
  );

  const nextManagedLinks = managedLinks.map((link) => {
    const action = String(link.metadata?.action || '').toLowerCase();
    const existing = links.find(
      (candidate) => candidate.group === 'primary' && isManagedLinkMatch(candidate, action),
    );

    if (!existing) {
      return link;
    }

    return {
      ...existing,
      type: link.type,
      group: link.group,
      label: existing.label || link.label,
      subtitle: existing.subtitle || link.subtitle,
      icon: existing.icon || link.icon,
      url: link.url,
      value: link.value,
      visible: existing.visible !== false,
      order: Number(existing.order ?? link.order),
      target: link.target,
      metadata: {
        ...(existing.metadata || {}),
        ...(link.metadata || {}),
      },
    };
  });

  return [...nextManagedLinks, ...otherLinks]
    .sort((first, second) => Number(first.order ?? 0) - Number(second.order ?? 0))
    .map((link, index) => ({
      ...link,
      order: Number(link.order ?? index + 1),
    }));
}

function normalizeSectionItems(items = [], section = {}) {
  return items
    .map((item, index) => {
      const normalizedItem = {
        ...item,
        id: item.id || `item-${index + 1}`,
      };

      if (section.key === 'services' || section.type === 'services') {
        normalizedItem.imageUrl = normalizeOptionalValue(item.imageUrl) || null;
        normalizedItem.imagePublicId = normalizeOptionalValue(item.imagePublicId) || '';
      }

      return normalizedItem;
    })
    .filter(Boolean);
}

function normalizeSectionsPayload(sections = []) {
  return sections
    .map((section, index) => {
      const key = String(section.key || '').trim();
      const type = getCanonicalSectionType(key, String(section.type || '').trim());

      return {
        key,
        type,
        title: String(section.title || '').trim(),
        description: String(section.description || '').trim(),
        order: Number(section.order ?? index + 1),
        visible: section.visible !== false,
        variant: String(section.variant || '').trim(),
        settings: section.settings || {},
        items: normalizeSectionItems(section.items, { ...section, key, type }),
      };
    })
    .map((section) => {
      if (section.key === 'about') {
        return {
          ...section,
          description: '',
        };
      }

      if (section.key === 'cta') {
        return normalizeCreatorSignatureCtaSection(section);
      }

      return section;
    })
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
    domains: {
      subdomain: business.domains?.subdomain || '',
      customDomain: business.domains?.customDomain || '',
    },
    publicUrl: buildBusinessPublicUrl(business),
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
      publicUrl: buildBusinessPublicUrl(graph.business),
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
    history: [...(graph.business.history || [])]
      .sort((first, second) => new Date(second.changedAt || 0).getTime() - new Date(first.changedAt || 0).getTime())
      .map((entry) => ({
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        changedAt: entry.changedAt,
      })),
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
  await assertBusinessSlugAvailable(businessPayload.slug);
  await assertBusinessDomainsAvailable(businessPayload.domains);
  const linksPayload = synchronizeManagedLinks(
    normalizeLinksPayload(input.links || defaults.links),
    businessPayload,
  );
  const business = await createBusinessRecord(businessPayload);

  await upsertThemeRecord(business._id, normalizeThemePayload(input.theme || defaults.theme));
  await replaceLinkRecords(business._id, linksPayload);
  await replaceSectionRecords(business._id, normalizeSectionsPayload(input.sections || defaults.sections));
  await upsertNfcTagRecord(business._id, normalizeTagPayload(input.nfcTag || defaults.nfcTag));
  await ensureDefaultSubscriptionForBusiness(business._id);
  await appendBusinessHistoryEntries(String(business._id), [
    {
      field: 'system.operation',
      oldValue: null,
      newValue: 'created',
      changedAt: new Date(),
    },
  ]);
  const editor = await hydrateEditorResponse(String(business._id));
  publishBusinessRealtimeUpdate(editor, { operation: 'created' });
  return editor;
}

export async function updateAdminBusiness(businessId, input) {
  const existingGraph = await findBusinessGraphForAdmin(businessId);
  const businessPayload = normalizeBusinessPayload(input.business || {});
  const themePayload = normalizeThemePayload(input.theme || {});
  const sectionsPayload = normalizeSectionsPayload(input.sections || []);
  const tagPayload = normalizeTagPayload(input.nfcTag || null);
  await assertBusinessSlugAvailable(businessPayload.slug, businessId);
  await assertBusinessDomainsAvailable(businessPayload.domains, businessId);
  const linksPayload = synchronizeManagedLinks(normalizeLinksPayload(input.links || []), businessPayload);
  const previousSnapshot = {
    business: normalizeBusinessPayload(existingGraph.business || {}),
    theme: normalizeThemePayload(existingGraph.theme || buildDefaultTenantSetup(existingGraph.business || {}).theme),
    links: normalizeLinksPayload(existingGraph.links || []),
    sections: normalizeSectionsPayload(existingGraph.sections || []),
    nfcTag: normalizeTagPayload(existingGraph.nfcTag || null),
  };
  const nextSnapshot = {
    business: businessPayload,
    theme: themePayload,
    links: linksPayload,
    sections: sectionsPayload,
    nfcTag: tagPayload,
  };
  const historyEntries = buildHistoryEntries(previousSnapshot, nextSnapshot);
  const business = await updateBusinessRecord(businessId, businessPayload);

  if (!business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  await Promise.all([
    upsertThemeRecord(businessId, themePayload),
    replaceLinkRecords(businessId, linksPayload),
    replaceSectionRecords(businessId, sectionsPayload),
    upsertNfcTagRecord(businessId, tagPayload),
    appendBusinessHistoryEntries(businessId, historyEntries),
  ]);

  const editor = await hydrateEditorResponse(businessId);
  publishBusinessRealtimeUpdate(editor, {
    operation: 'updated',
    previousSlug: existingGraph.business?.slug,
    previousDomains: existingGraph.business?.domains,
  });

  return editor;
}

export async function updateAdminBusinessStatus(businessId, status) {
  const existingGraph = await findBusinessGraphForAdmin(businessId);
  const business = await updateBusinessRecord(businessId, { status });

  if (!business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  await appendBusinessHistoryEntries(businessId, [
    {
      field: 'business.status',
      oldValue: existingGraph.business?.status || null,
      newValue: status,
      changedAt: new Date(),
    },
  ]);

  const editor = await hydrateEditorResponse(businessId);
  publishBusinessRealtimeUpdate(editor, {
    operation: 'status_changed',
    previousSlug: existingGraph.business?.slug,
    previousDomains: existingGraph.business?.domains,
  });

  return editor;
}

export async function deleteAdminBusiness(businessId) {
  const existing = await findBusinessGraphForAdmin(businessId);

  if (!existing.business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  await deleteBusinessGraphRecords(businessId);
  publishTenantUpdated({
    operation: 'deleted',
    businessId,
    slug: existing.business.slug,
    previousSlug: existing.business.slug,
    status: 'deleted',
    publicUrl: buildBusinessPublicUrl(existing.business),
    domains: existing.business.domains,
    previousDomains: existing.business.domains,
  });

  return {
    deleted: true,
    businessId,
    slug: existing.business.slug,
  };
}
