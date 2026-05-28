import { BUSINESS_STATUS, LINK_GROUPS, LINK_TYPES, SECTION_TYPES } from '../../../shared/constants/index.js';
import { normalizeBusinessContact } from '../../../shared/utils/businessContact.js';
import { buildBusinessSegmentState } from '../../../shared/utils/segments.js';
import { normalizePhoneActionValue, slugify } from '../../../shared/utils/tenantIdentity.js';
import { createDefaultTheme } from '../../../shared/utils/theme.js';

function buildMailToLink(email) {
  return `mailto:${String(email || '').trim()}`;
}

function mergeActionConfig(defaultAction, action) {
  if (!defaultAction && !action) {
    return undefined;
  }

  return {
    ...(defaultAction || {}),
    ...(action || {}),
  };
}

export function buildCreatorSignatureCtaSection(overrides = {}) {
  const settings = overrides.settings || {};
  const section = {
    key: 'cta',
    type: SECTION_TYPES.CTA,
    title: '',
    description: '',
    order: 100,
    visible: false,
    variant: '',
    settings: {
      variant: 'footer-signature',
      eyebrow: '',
      primaryAction: {
        label: '',
        href: '',
      },
    },
    items: [],
  };

  return {
    ...section,
    ...overrides,
    title: String(overrides.title || '').trim() || section.title,
    description: String(overrides.description || '').trim() || section.description,
    settings: {
      ...section.settings,
      ...settings,
      primaryAction: mergeActionConfig(section.settings.primaryAction, settings.primaryAction),
      secondaryAction: mergeActionConfig(undefined, settings.secondaryAction),
    },
    items: Array.isArray(overrides.items) ? overrides.items : section.items,
  };
}

export function normalizeCreatorSignatureCtaSection(section = {}) {
  const normalizedTitle = String(section.title || '').trim().toLowerCase();
  const isLegacyDefault = normalizedTitle === 'pronto para voltar?' || normalizedTitle === 'cta';

  return buildCreatorSignatureCtaSection({
    ...section,
    title: isLegacyDefault ? '' : section.title,
    description: isLegacyDefault ? '' : section.description,
    visible: isLegacyDefault ? false : section.visible === true,
    settings: section.settings || {},
    items: Array.isArray(section.items) ? section.items : [],
  });
}

export function buildManagedPrimaryLinks(business) {
  const links = [];
  const contact = business.contact || {};
  const whatsappValue = normalizePhoneActionValue(contact.whatsapp);
  const phoneValue = normalizePhoneActionValue(contact.phone);
  const emailValue = String(contact.email || '').trim().toLowerCase();
  const nextOrder = () => links.length + 1;

  if (whatsappValue) {
    links.push({
      type: LINK_TYPES.CONTACT,
      group: LINK_GROUPS.PRIMARY,
      label: 'WhatsApp',
      subtitle: 'Fale com o negocio',
      icon: 'whatsapp',
      url: `https://wa.me/${whatsappValue}`,
      order: nextOrder(),
      target: '_blank',
      metadata: { action: 'whatsapp' },
    });
  }

  if (phoneValue) {
    links.push({
      type: LINK_TYPES.CONTACT,
      group: LINK_GROUPS.PRIMARY,
      label: 'Telefone',
      subtitle: 'Ligue agora',
      icon: 'phone',
      url: `tel:+${phoneValue}`,
      order: nextOrder(),
      target: '_self',
      metadata: { action: 'phone' },
    });
  }

  if (emailValue) {
    links.push({
      type: LINK_TYPES.CONTACT,
      group: LINK_GROUPS.PRIMARY,
      label: 'E-mail',
      subtitle: 'Envie uma mensagem',
      icon: 'mail',
      url: buildMailToLink(emailValue),
      order: nextOrder(),
      target: '_self',
      metadata: { action: 'email' },
    });
  }

  if (contact.wifi?.password) {
    links.push({
      type: LINK_TYPES.WIFI,
      group: LINK_GROUPS.PRIMARY,
      label: 'Wi-Fi',
      subtitle: 'Abrir senha e QR Code',
      icon: 'wifi',
      value: contact.wifi.password,
      order: nextOrder(),
      target: '_self',
      metadata: { action: 'wifi' },
    });
  }

  if (contact.pix?.key) {
    links.push({
      type: LINK_TYPES.PIX,
      group: LINK_GROUPS.PRIMARY,
      label: 'PIX',
      subtitle: 'Abrir dados de pagamento',
      icon: 'pix',
      value: contact.pix.key,
      order: nextOrder(),
      target: '_self',
      metadata: { action: 'pix' },
    });
  }

  return links;
}

function buildSections(business) {
  const hasWifi = Boolean(business.contact?.wifi?.password);
  const hasPix = Boolean(business.contact?.pix?.key);

  return [
    {
      key: 'hero-main',
      type: SECTION_TYPES.HERO,
      title: business.name,
      description: business.description,
      order: 10,
      visible: true,
      variant: 'spotlight',
      settings: {
        badge: business.badge || 'Pagina NFC',
        showAddress: true,
        showHours: true,
        showRating: true,
      },
      items: [],
    },
    {
      key: 'quick-actions',
      type: SECTION_TYPES.LINKS,
      title: 'Acesso rapido',
      description: 'Atalhos principais do negocio em um unico lugar.',
      order: 20,
      visible: true,
      settings: {
        group: LINK_GROUPS.PRIMARY,
        layout: 'compact',
      },
      items: [],
    },
    {
      key: 'services',
      type: SECTION_TYPES.SERVICES,
      title: 'Servicos',
      description: '',
      order: 30,
      visible: false,
      settings: {},
      items: [],
    },
    {
      key: 'contact',
      type: SECTION_TYPES.CONTACT,
      title: 'Contato e atendimento',
      description: '',
      order: 40,
      visible: true,
      settings: {},
      items: [],
    },
    {
      key: 'gallery',
      type: SECTION_TYPES.GALLERY,
      title: 'Galeria',
      description: 'Mostre fotos do ambiente, produtos ou servicos.',
      order: 50,
      visible: false,
      settings: {},
      items: [],
    },
    {
      key: 'about',
      type: SECTION_TYPES.CUSTOM,
      title: 'Sobre nos',
      description: '',
      order: 60,
      visible: Boolean(business.description),
      settings: {
        tone: 'story',
        eyebrow: 'Apresentacao',
      },
      items: business.description ? [{ id: 'about-1', body: business.description }] : [],
    },
    {
      key: 'pix',
      type: SECTION_TYPES.PIX,
      title: 'Pagamento via PIX',
      description: 'Escaneie o QR Code ou confira a chave PIX.',
      order: 70,
      visible: hasPix,
      settings: {
        allowAmountInput: true,
      },
      items: [],
    },
    {
      ...buildCreatorSignatureCtaSection({
        order: 80,
      }),
    },
  ];
}

export function buildDefaultTenantSetup(input = {}) {
  const name = String(input.name || 'Novo comercio').trim();
  const slug = slugify(input.slug || input.name || 'novo-comercio', { maxLength: 80 }) || `negocio-${Date.now()}`;
  const description = String(input.description || '').trim();
  const addressDisplay = String(input.address?.display || input.addressDisplay || '').trim();
  const mapUrl = String(input.address?.mapUrl || input.mapUrl || '').trim();
  const segmentState = buildBusinessSegmentState(input);

  const business = {
    name,
    legalName: String(input.legalName || '').trim(),
    slug,
    description,
    logoUrl: String(input.logoUrl || '').trim(),
    bannerUrl: String(input.bannerUrl || '').trim(),
    badge: String(input.badge || name).trim(),
    status: input.status || BUSINESS_STATUS.ACTIVE,
    rating: String(input.rating || '').trim(),
    segment: segmentState.segment,
    modules: segmentState.modules,
    segmentConfig: segmentState.segmentConfig,
    address: {
      display: addressDisplay,
      mapUrl,
      embedUrl: String(input.address?.embedUrl || '').trim(),
    },
    hours: Array.isArray(input.hours) ? input.hours : [],
    contact: normalizeBusinessContact({
      whatsapp: input.contact?.whatsapp || input.whatsapp,
      phone: input.contact?.phone || input.phone,
      email: input.contact?.email || input.email,
      wifi: input.contact?.wifi,
      pix: input.contact?.pix,
    }),
    seo: {
      title: `${name} | Pagina NFC`,
      description: description || `Pagina NFC oficial de ${name}.`,
      imageUrl: String(input.bannerUrl || input.logoUrl || '').trim(),
    },
  };

  return {
    business,
    theme: createDefaultTheme().raw,
    links: buildManagedPrimaryLinks(business),
    sections: buildSections(business),
    nfcTag: {
      code: String(input.nfcTag?.code || `${slug.toUpperCase().replace(/-/g, '')}-001`).slice(0, 40),
      status: String(input.nfcTag?.status || 'active'),
    },
  };
}
