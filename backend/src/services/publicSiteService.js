import { AppError } from '../utils/appError.js';
import { findBusinessBySlug, findBusinessByTenantContext } from '../repositories/businessRepository.js';
import { findThemeByBusinessId } from '../repositories/themeRepository.js';
import { listVisibleSectionsByBusinessId } from '../repositories/sectionRepository.js';
import { listVisibleLinksByBusinessId } from '../repositories/linkRepository.js';
import { findTagByCode, touchTag } from '../repositories/nfcTagRepository.js';
import { env } from '../config/env.js';
import {
  buildManagedPrimaryLinks,
  normalizeCreatorSignatureCtaSection,
} from '../utils/adminDefaults.js';
import { BUSINESS_STATUS } from '../../../shared/constants/index.js';

function normalizePhoneActionValue(value, countryCode = '55') {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith(countryCode)) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `${countryCode}${digits}`;
  }

  return digits;
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

function mergePrimaryLinks(links, business) {
  const managedLinks = buildManagedPrimaryLinks(business);
  const managedActions = managedLinks
    .map((link) => String(link.metadata?.action || '').toLowerCase())
    .filter(Boolean);

  const customPrimaryLinks = links.filter(
    (link) =>
      link.group === 'primary' &&
      !managedActions.some((action) => isManagedLinkMatch(link, action)),
  );

  const hydratedManagedLinks = managedLinks.map((link) => {
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
      target: link.target,
      metadata: {
        ...(existing.metadata || {}),
        ...(link.metadata || {}),
      },
    };
  });

  return [...hydratedManagedLinks, ...customPrimaryLinks].sort(
    (first, second) => first.order - second.order,
  );
}

function buildContactItems(business) {
  const items = [];
  const contact = business.contact || {};
  const whatsappValue = normalizePhoneActionValue(contact.whatsapp);
  const phoneValue = normalizePhoneActionValue(contact.phone);
  const emailValue = String(contact.email || '').trim().toLowerCase();

  if (whatsappValue) {
    items.push({
      id: 'contact-whatsapp',
      label: 'WhatsApp',
      value: whatsappValue,
      href: `https://wa.me/${whatsappValue}`,
      action: 'external',
    });
  }

  if (phoneValue) {
    items.push({
      id: 'contact-phone',
      label: 'Telefone',
      value: phoneValue,
      href: `tel:+${phoneValue}`,
      action: 'external',
    });
  }

  if (emailValue) {
    items.push({
      id: 'contact-email',
      label: 'E-mail',
      value: emailValue,
      href: `mailto:${emailValue}`,
      action: 'external',
    });
  }

  if (business.address?.display) {
    items.push({
      id: 'contact-address',
      label: 'Endereco',
      value: business.address.display,
      href: business.address.mapUrl || '',
      action: business.address.mapUrl ? 'external' : 'display',
    });
  }

  return items;
}

function buildHeroPrimaryAction(business, settings) {
  const whatsappValue = normalizePhoneActionValue(business.contact?.whatsapp);

  if (!whatsappValue) {
    return undefined;
  }

  return {
    label: settings.primaryAction?.label || 'Agendar pelo WhatsApp',
    href: `https://wa.me/${whatsappValue}`,
  };
}

function buildHeroSecondaryAction(business, settings) {
  if (!business.contact?.pix?.key) {
    return undefined;
  }

  return {
    label: settings.secondaryAction?.label || 'Copiar PIX',
    action: 'pix',
  };
}

function sanitizePublicSectionItem(item, fallbackId) {
  if (!item) {
    return item;
  }

  const nextItem = {
    ...item,
    id: item.id || item._id?.toString() || fallbackId,
  };

  delete nextItem.imagePublicId;
  delete nextItem.publicId;

  return nextItem;
}

function isPubliclyAccessibleStatus(status) {
  return status === BUSINESS_STATUS.ACTIVE || status === BUSINESS_STATUS.DRAFT;
}

function buildBusinessPublicSiteUrl(business) {
  if (business?.domains?.customDomain) {
    return `https://${business.domains.customDomain}`;
  }

  if (business?.domains?.subdomain) {
    try {
      const baseUrl = new URL(env.publicSiteBaseUrl);
      return `${baseUrl.protocol}//${business.domains.subdomain}.${baseUrl.host}`;
    } catch {
      // Fall through to the slug URL when the configured base URL is invalid.
    }
  }

  return `${env.publicSiteBaseUrl.replace(/\/$/, '')}/site/${business.slug}`;
}

function hydrateSection(section, business, links) {
  const settings = { ...(section.settings || {}) };

  switch (section.type) {
    case 'hero':
      return {
        ...section,
        title: business.name || section.title,
        description: business.description || '',
        settings: {
          ...settings,
          badge: business.badge || settings.badge,
          rating: business.rating || settings.rating,
          address: business.address?.display,
          hours: business.hours || [],
          bannerUrl: business.bannerUrl || settings.bannerUrl,
          logoUrl: business.logoUrl || settings.logoUrl,
          primaryAction: buildHeroPrimaryAction(business, settings),
          secondaryAction: buildHeroSecondaryAction(business, settings),
        },
      };
    case 'links':
      return {
        ...section,
        items:
          (settings.group || 'primary') === 'primary'
            ? mergePrimaryLinks(links, business)
            : links.filter((link) => link.group === (settings.group || 'primary')),
        settings,
      };
    case 'social':
      return null;
    case 'contact': {
      const items = buildContactItems(business);
      if (!items.length) {
        return null;
      }

      return {
        ...section,
        items,
        settings: {
          ...settings,
          hours: business.hours || [],
        },
      };
    }
    case 'wifi':
      return null;
    case 'pix':
      if (!business.contact?.pix?.key) {
        return null;
      }

      return {
        ...section,
        settings: {
          ...settings,
          ...business.contact.pix,
        },
      };
    case 'map':
      if (!business.address?.mapUrl && !business.address?.embedUrl) {
        return null;
      }

      return {
        ...section,
        settings: {
          ...settings,
          ...business.address,
        },
      };
    case 'custom':
      return {
        ...section,
        description: section.key === 'about' ? '' : section.description,
        settings,
      };
    case 'cta':
      return normalizeCreatorSignatureCtaSection({
        ...section,
        settings,
      });
    default:
      return {
        ...section,
        settings,
      };
  }
}

export async function getPublicSiteBySlug(reference) {
  const tenantReference = typeof reference === 'string' ? { slug: reference } : reference;
  const business = await findBusinessByTenantContext(tenantReference);

  if (!business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  if (!isPubliclyAccessibleStatus(business.status)) {
    throw new AppError(
      'Este site esta temporariamente indisponivel.',
      423,
      'business_inactive',
    );
  }

  const [theme, sections, links] = await Promise.all([
    findThemeByBusinessId(business._id),
    listVisibleSectionsByBusinessId(business._id),
    listVisibleLinksByBusinessId(business._id),
  ]);

  if (!theme) {
    throw new AppError('Tema do negocio nao encontrado', 500, 'business_theme_missing');
  }

  const hydratedSections = sections
    .map((section) => hydrateSection(section, business, links))
    .filter(Boolean)
    .sort((first, second) => first.order - second.order);

  return {
    business: {
      id: business._id.toString(),
      slug: business.slug,
      name: business.name,
      legalName: business.legalName,
      description: business.description,
      logoUrl: business.logoUrl,
      bannerUrl: business.bannerUrl,
      badge: business.badge,
      status: business.status,
      domains: business.domains || {},
      address: business.address,
      hours: business.hours || [],
      rating: business.rating,
      contact: business.contact || {},
      seo: {
        title: business.seo?.title,
        description: business.seo?.description,
        imageUrl: business.seo?.imageUrl,
      },
    },
    theme: {
      colors: theme.colors,
      typography: theme.typography,
      spacing: theme.spacing,
      radius: theme.radius,
      layout: theme.layout,
      buttons: theme.buttons,
      customCss: theme.customCss,
    },
    sections: hydratedSections.map((section) => ({
      id: section._id.toString(),
      key: section.key,
      type: section.type,
      title: section.title,
      description: section.description,
      order: section.order,
      visible: section.visible,
      variant: section.variant,
      settings: section.settings || {},
      items: (section.items || []).map((item, index) =>
        sanitizePublicSectionItem(item, `${section.key}-${index + 1}`),
      ),
    })),
    links: links.map((link) => ({
      id: link._id.toString(),
      type: link.type,
      group: link.group,
      label: link.label,
      subtitle: link.subtitle,
      icon: link.icon,
      url: link.url,
      value: link.value,
      visible: link.visible,
      order: link.order,
      target: link.target,
      metadata: link.metadata || {},
    })),
    seo: {
      title: business.seo?.title,
      description: business.seo?.description,
      imageUrl: business.seo?.imageUrl,
    },
  };
}

export async function resolveTagToSite(tagCode) {
  const tag = await findTagByCode(tagCode);

  if (!tag?.businessId) {
    throw new AppError('Tag NFC nao encontrada', 404, 'nfc_tag_not_found');
  }

  const business = tag.businessId;

  if (!isPubliclyAccessibleStatus(business.status)) {
    throw new AppError('Este site esta temporariamente indisponivel.', 423, 'business_inactive');
  }

  await touchTag(tagCode);

  return {
    tagCode,
    businessId: business._id.toString(),
    slug: business.slug,
    siteUrl: buildBusinessPublicSiteUrl(business),
  };
}

export async function assertBusinessExists(reference) {
  if (reference.businessId) {
    return reference.businessId;
  }

  const business = await findBusinessBySlug(reference.slug);

  if (!business) {
    throw new AppError('Negocio nao encontrado para analytics', 404, 'business_not_found');
  }

  return business._id.toString();
}
