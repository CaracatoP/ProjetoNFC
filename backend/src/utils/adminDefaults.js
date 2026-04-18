import { BUSINESS_STATUS, LINK_GROUPS, LINK_TYPES, SECTION_TYPES } from '../../../shared/constants/index.js';

function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function createDefaultTheme() {
  return {
    colors: {
      primary: '#f97316',
      secondary: '#fb7185',
      background: '#140d09',
      surface: 'rgba(31, 20, 16, 0.92)',
      surfaceAlt: 'rgba(48, 32, 24, 0.86)',
      text: '#fff8f2',
      textMuted: '#f4d5c3',
      border: 'rgba(255, 255, 255, 0.12)',
      success: '#22c55e',
      danger: '#ef4444',
      accent: 'rgba(249, 115, 22, 0.18)',
    },
    typography: {
      headingFamily: "'Space Grotesk', sans-serif",
      bodyFamily: "'Manrope', sans-serif",
      baseSize: '16px',
      heroSize: 'clamp(2.2rem, 5.8vw, 4rem)',
      sectionTitleSize: 'clamp(1.15rem, 2.8vw, 1.7rem)',
    },
    spacing: {
      xs: '0.35rem',
      sm: '0.65rem',
      md: '1rem',
      lg: '1.4rem',
      xl: '1.8rem',
      xxl: '2.4rem',
    },
    radius: {
      sm: '0.9rem',
      md: '1.4rem',
      lg: '2rem',
      pill: '999px',
    },
    layout: {
      maxWidth: '1180px',
      pagePadding: 'clamp(1rem, 3vw, 2rem)',
      sectionGap: '1.1rem',
      cardGap: '0.85rem',
    },
    buttons: {
      primary: {
        background: 'linear-gradient(135deg, #f97316, #fb7185)',
        color: '#ffffff',
        border: 'none',
      },
      secondary: {
        background: 'rgba(255, 255, 255, 0.06)',
        color: '#fff8f2',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      },
    },
    customCss: '',
  };
}

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
    title: 'Feito por Caraçato',
    description: 'Entre em contato pelo Instagram @caracato_.',
    order: 100,
    visible: true,
    variant: '',
    settings: {
      variant: 'footer-signature',
      eyebrow: 'Criacao do site',
      primaryAction: {
        label: 'Instagram @caracato_',
        href: 'https://instagram.com/caracato_',
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
    visible: section.visible !== false,
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
      subtitle: 'Copiar chave de pagamento',
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
        primaryAction: business.contact?.whatsapp
          ? {
              label: 'Agendar pelo WhatsApp',
              href: `https://wa.me/${business.contact.whatsapp}`,
            }
          : undefined,
        secondaryAction: hasPix
          ? {
              label: 'Copiar PIX',
              action: 'pix',
            }
          : undefined,
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
      description: 'Adicione os servicos e precos do negocio.',
      order: 30,
      visible: false,
      settings: {
        showPixShortcut: hasPix,
      },
      items: [],
    },
    {
      key: 'contact',
      type: SECTION_TYPES.CONTACT,
      title: 'Contato e atendimento',
      description: 'Horarios, localizacao e canais oficiais do negocio.',
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
      description: 'Escaneie ou copie a chave PIX.',
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
  const slug = toSlug(input.slug || input.name || 'novo-comercio') || `negocio-${Date.now()}`;
  const description = String(input.description || '').trim();
  const addressDisplay = String(input.address?.display || input.addressDisplay || '').trim();
  const mapUrl = String(input.address?.mapUrl || input.mapUrl || '').trim();

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
    address: {
      display: addressDisplay,
      mapUrl,
      embedUrl: String(input.address?.embedUrl || '').trim(),
    },
    hours: Array.isArray(input.hours) ? input.hours : [],
    contact: {
      whatsapp: String(input.contact?.whatsapp || input.whatsapp || '').trim(),
      phone: String(input.contact?.phone || input.phone || '').trim(),
      email: String(input.contact?.email || input.email || '').trim(),
      wifi: input.contact?.wifi || undefined,
      pix: input.contact?.pix || undefined,
    },
    seo: {
      title: `${name} | Pagina NFC`,
      description: description || `Pagina NFC oficial de ${name}.`,
      imageUrl: String(input.bannerUrl || input.logoUrl || '').trim(),
    },
  };

  return {
    business,
    theme: createDefaultTheme(),
    links: buildManagedPrimaryLinks(business),
    sections: buildSections(business),
    nfcTag: {
      code: String(input.nfcTag?.code || `${slug.toUpperCase().replace(/-/g, '')}-001`).slice(0, 40),
      status: String(input.nfcTag?.status || 'active'),
    },
  };
}
