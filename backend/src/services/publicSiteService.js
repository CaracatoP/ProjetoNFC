import { AppError } from '../utils/appError.js';
import { findBusinessBySlug, findPublicBusinessBySlug } from '../repositories/businessRepository.js';
import { findThemeByBusinessId } from '../repositories/themeRepository.js';
import { listVisibleSectionsByBusinessId } from '../repositories/sectionRepository.js';
import { listVisibleLinksByBusinessId } from '../repositories/linkRepository.js';
import { findTagByCode, touchTag } from '../repositories/nfcTagRepository.js';
import { env } from '../config/env.js';

function buildContactItems(business) {
  const items = [];
  const contact = business.contact || {};

  if (contact.whatsapp) {
    items.push({
      id: 'contact-whatsapp',
      label: 'WhatsApp',
      value: contact.whatsapp,
      href: `https://wa.me/${contact.whatsapp}`,
      action: 'external',
    });
  }

  if (contact.phone) {
    items.push({
      id: 'contact-phone',
      label: 'Telefone',
      value: contact.phone,
      href: `tel:+${contact.phone}`,
      action: 'external',
    });
  }

  if (contact.email) {
    items.push({
      id: 'contact-email',
      label: 'E-mail',
      value: contact.email,
      href: `mailto:${contact.email}`,
      action: 'external',
    });
  }

  if (business.address?.display) {
    items.push({
      id: 'contact-address',
      label: 'Endereço',
      value: business.address.display,
      href: business.address.mapUrl,
      action: 'external',
    });
  }

  return items;
}

function hydrateSection(section, business, links) {
  const settings = { ...(section.settings || {}) };

  switch (section.type) {
    case 'hero':
      return {
        ...section,
        settings: {
          ...settings,
          badge: settings.badge || business.badge,
          rating: settings.rating || business.rating,
          address: business.address?.display,
          hours: business.hours || [],
          bannerUrl: settings.bannerUrl || business.bannerUrl,
          logoUrl: settings.logoUrl || business.logoUrl,
        },
      };
    case 'links':
    case 'social':
      return {
        ...section,
        items: links.filter((link) => link.group === (settings.group || 'primary')),
        settings,
      };
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
      if (!business.contact?.wifi?.password) {
        return null;
      }

      return {
        ...section,
        settings: {
          ...settings,
          ...business.contact.wifi,
        },
      };
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
    default:
      return {
        ...section,
        settings,
      };
  }
}

export async function getPublicSiteBySlug(slug) {
  const business = await findPublicBusinessBySlug(slug);

  if (!business) {
    throw new AppError('Negócio não encontrado', 404, 'business_not_found');
  }

  const [theme, sections, links] = await Promise.all([
    findThemeByBusinessId(business._id),
    listVisibleSectionsByBusinessId(business._id),
    listVisibleLinksByBusinessId(business._id),
  ]);

  if (!theme) {
    throw new AppError('Tema do negócio não encontrado', 500, 'business_theme_missing');
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
      address: business.address,
      hours: business.hours || [],
      rating: business.rating,
      contact: business.contact || {},
      seo: business.seo,
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
      items: (section.items || []).map((item, index) => ({
        ...item,
        id: item.id || item._id?.toString() || `${section.key}-${index + 1}`,
      })),
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
    seo: business.seo,
  };
}

export async function resolveTagToSite(tagCode) {
  const tag = await findTagByCode(tagCode);

  if (!tag?.businessId) {
    throw new AppError('Tag NFC não encontrada', 404, 'nfc_tag_not_found');
  }

  const business = tag.businessId;

  if (business.status !== 'active') {
    throw new AppError('Negócio inativo para esta tag', 404, 'business_inactive');
  }

  await touchTag(tagCode);

  return {
    tagCode,
    businessId: business._id.toString(),
    slug: business.slug,
    siteUrl: `${env.publicSiteBaseUrl.replace(/\/$/, '')}/site/${business.slug}`,
  };
}

export async function assertBusinessExists(reference) {
  if (reference.businessId) {
    return reference.businessId;
  }

  const business = await findBusinessBySlug(reference.slug);

  if (!business) {
    throw new AppError('Negócio não encontrado para analytics', 404, 'business_not_found');
  }

  return business._id.toString();
}
