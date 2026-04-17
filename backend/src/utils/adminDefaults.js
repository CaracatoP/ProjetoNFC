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

function buildPrimaryLinks(business) {
  const links = [];
  const contact = business.contact || {};
  const address = business.address || {};

  if (contact.whatsapp) {
    links.push({
      type: LINK_TYPES.CONTACT,
      group: LINK_GROUPS.PRIMARY,
      label: 'WhatsApp',
      subtitle: 'Fale com o negocio',
      icon: 'whatsapp',
      url: `https://wa.me/${contact.whatsapp}`,
      order: 1,
      target: '_blank',
    });
  }

  if (contact.phone) {
    links.push({
      type: LINK_TYPES.CONTACT,
      group: LINK_GROUPS.PRIMARY,
      label: 'Telefone',
      subtitle: 'Ligue agora',
      icon: 'phone',
      url: `tel:+${contact.phone}`,
      order: 2,
      target: '_self',
    });
  }

  if (address.mapUrl) {
    links.push({
      type: LINK_TYPES.EXTERNAL,
      group: LINK_GROUPS.PRIMARY,
      label: 'Como chegar',
      subtitle: 'Abrir rota no mapa',
      icon: 'map',
      url: address.mapUrl,
      order: 3,
      target: '_blank',
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
      order: 4,
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
      order: 5,
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
      description: business.description,
      order: 60,
      visible: Boolean(business.description),
      settings: {
        tone: 'story',
        eyebrow: 'Apresentacao',
      },
      items: business.description ? [{ id: 'about-1', body: business.description }] : [],
    },
    {
      key: 'wifi',
      type: SECTION_TYPES.WIFI,
      title: 'Wi-Fi do local',
      description: 'Abra esta conveniencia apenas por clique.',
      order: 70,
      visible: hasWifi,
      settings: {
        displayMode: 'modal',
      },
      items: [],
    },
    {
      key: 'pix',
      type: SECTION_TYPES.PIX,
      title: 'Pagamento via PIX',
      description: 'Escaneie ou copie a chave PIX.',
      order: 80,
      visible: hasPix,
      settings: {
        allowAmountInput: true,
      },
      items: [],
    },
    {
      key: 'social',
      type: SECTION_TYPES.SOCIAL,
      title: 'Redes sociais',
      description: 'Continue o relacionamento nos canais digitais.',
      order: 90,
      visible: false,
      settings: {
        group: LINK_GROUPS.SOCIAL,
      },
      items: [],
    },
    {
      key: 'cta',
      type: SECTION_TYPES.CTA,
      title: 'Fale com o negocio',
      description: 'Mantenha um CTA final de conversao na pagina.',
      order: 100,
      visible: true,
      settings: {
        primaryAction: business.contact?.whatsapp
          ? {
              label: 'Conversar no WhatsApp',
              href: `https://wa.me/${business.contact.whatsapp}`,
            }
          : undefined,
      },
      items: [],
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
    status: input.status || BUSINESS_STATUS.DRAFT,
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
    links: buildPrimaryLinks(business),
    sections: buildSections(business),
    nfcTag: {
      code: String(input.nfcTag?.code || `${slug.toUpperCase().replace(/-/g, '')}-001`).slice(0, 40),
      status: String(input.nfcTag?.status || 'active'),
    },
  };
}
