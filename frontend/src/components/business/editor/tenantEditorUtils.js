export function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function hexToRgb(value) {
  const hex = String(value || '').trim().replace('#', '');

  if (!/^[\da-fA-F]{6}$/.test(hex)) {
    return null;
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function hexToRgba(value, alpha) {
  const rgb = hexToRgb(value);

  if (!rgb) {
    return value;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function mixHexColors(base, mixWith, weight) {
  const first = hexToRgb(base);
  const second = hexToRgb(mixWith);

  if (!first || !second) {
    return base;
  }

  const mixChannel = (channel) =>
    Math.round(first[channel] * (1 - weight) + second[channel] * weight)
      .toString(16)
      .padStart(2, '0');

  return `#${mixChannel('r')}${mixChannel('g')}${mixChannel('b')}`;
}

function getReadableTextColor(background) {
  const rgb = hexToRgb(background);

  if (!rgb) {
    return '#ffffff';
  }

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.58 ? '#1a120f' : '#ffffff';
}

export function buildDerivedTheme(theme, overrides) {
  const palette = {
    primary: overrides.primary || theme.colors?.primary || '#f97316',
    secondary: overrides.secondary || theme.colors?.secondary || '#fb7185',
    background: overrides.background || theme.colors?.background || '#140d09',
    text: overrides.text || theme.colors?.text || '#fff8f2',
  };

  const elevatedSurface = mixHexColors(palette.background, '#ffffff', 0.08);
  const alternateSurface = mixHexColors(palette.background, '#ffffff', 0.16);

  return {
    ...theme,
    colors: {
      ...theme.colors,
      primary: palette.primary,
      secondary: palette.secondary,
      background: palette.background,
      surface: hexToRgba(elevatedSurface, 0.92),
      surfaceAlt: hexToRgba(alternateSurface, 0.86),
      text: palette.text,
      textMuted: hexToRgba(palette.text, 0.74),
      border: hexToRgba(palette.text, 0.12),
      accent: hexToRgba(palette.primary, 0.18),
      success: theme.colors?.success || '#22c55e',
      danger: theme.colors?.danger || '#ef4444',
    },
    buttons: {
      ...theme.buttons,
      primary: {
        ...(theme.buttons?.primary || {}),
        background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
        color: getReadableTextColor(mixHexColors(palette.primary, palette.secondary, 0.5)),
        border: 'none',
      },
      secondary: {
        ...(theme.buttons?.secondary || {}),
        background: hexToRgba(palette.text, 0.06),
        color: palette.text,
        border: `1px solid ${hexToRgba(palette.text, 0.12)}`,
      },
    },
  };
}

export function isHexColor(value) {
  return /^#([\da-fA-F]{6}|[\da-fA-F]{3})$/.test(String(value || '').trim());
}

export function normalizeHexColor(value, fallback = '#000000') {
  const trimmed = String(value || '').trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

  if (!isHexColor(withHash)) {
    return fallback;
  }

  if (withHash.length === 4) {
    return `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`.toLowerCase();
  }

  return withHash.toLowerCase();
}

export function slugify(value, { preserveTrailingSeparator = false } = {}) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '');

  return preserveTrailingSeparator ? normalized : normalized.replace(/-+$/g, '');
}

export function normalizeOptionalHost(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');

  return normalized || '';
}

function getEnvironmentOrigin(fallbackUrl = '') {
  const browserOrigin = typeof window !== 'undefined' ? String(window.location.origin || '').replace(/\/$/, '') : '';

  if (browserOrigin) {
    return browserOrigin;
  }

  try {
    return new URL(fallbackUrl).origin;
  } catch {
    return '';
  }
}

function buildSubdomainPreviewUrl(subdomain, fallbackUrl = '') {
  const normalizedSubdomain = slugify(subdomain);

  if (!normalizedSubdomain) {
    return '';
  }

  const baseOrigin = getEnvironmentOrigin(fallbackUrl);

  try {
    const baseUrl = new URL(baseOrigin || fallbackUrl);
    return `${baseUrl.protocol}//${normalizedSubdomain}.${baseUrl.host}`;
  } catch {
    return `https://${normalizedSubdomain}.seu-dominio.com`;
  }
}

export function buildTenantPublicUrlPreview(business = {}, fallbackUrl = '') {
  const slug = slugify(business.slug);
  const customDomain = normalizeOptionalHost(business.domains?.customDomain);
  const subdomain = slugify(business.domains?.subdomain);
  const origin = getEnvironmentOrigin(fallbackUrl);
  const slugUrl = slug && origin ? `${origin}/site/${slug}` : slug ? `/site/${slug}` : '';
  const subdomainUrl = buildSubdomainPreviewUrl(subdomain, fallbackUrl);

  return {
    slugUrl,
    subdomainUrl,
    customDomainUrl: customDomain ? `https://${customDomain}` : '',
    preferredUrl: customDomain ? `https://${customDomain}` : subdomainUrl || slugUrl || fallbackUrl || '',
  };
}

export function ensureSection(draft, key, fallbackType = 'custom') {
  const existing = draft.sections.find((section) => section.key === key);

  if (existing) {
    return existing;
  }

  const nextSection = {
    id: key,
    key,
    type: fallbackType,
    title: '',
    description: '',
    order: draft.sections.length + 1,
    visible: false,
    variant: '',
    settings: {},
    items: [],
  };

  draft.sections = [...draft.sections, nextSection];
  return nextSection;
}

export function updateSectionDraft(draft, key, fallbackType, updater) {
  const section = ensureSection(draft, key, fallbackType);
  updater(section);
}

export function newLinkItem() {
  return {
    id: `link-${Date.now()}`,
    type: 'external',
    group: 'primary',
    label: '',
    subtitle: '',
    icon: 'default',
    url: '',
    value: '',
    visible: true,
    order: Date.now(),
    target: '_blank',
    metadata: {},
  };
}

export function newServiceItem() {
  return {
    id: `service-${Date.now()}`,
    name: '',
    description: '',
    price: 0,
    imageUrl: null,
  };
}

export function newGalleryItem() {
  return {
    id: `gallery-${Date.now()}`,
    imageUrl: '',
    imagePublicId: '',
    alt: '',
  };
}

export function newHourItem() {
  return {
    id: `hour-${Date.now()}`,
    label: '',
    value: '',
  };
}

const SECTION_LABELS = {
  'hero-main': 'Hero principal',
  'quick-actions': 'Acesso rapido',
  services: 'Servicos',
  contact: 'Contato e atendimento',
  gallery: 'Galeria',
  about: 'Sobre nos',
  pix: 'Pagamento PIX',
  cta: 'Assinatura do criador',
};

const SECTION_TYPE_LABELS = {
  hero: 'Hero',
  links: 'Links e atalhos',
  services: 'Servicos',
  contact: 'Contato',
  gallery: 'Galeria',
  custom: 'Conteudo livre',
  pix: 'PIX',
  cta: 'Footer promocional',
};

export const HIDDEN_ADMIN_SECTION_KEYS = new Set(['wifi', 'social']);

const ANALYTICS_EVENT_LABELS = {
  page_view: 'Visualizacao de pagina',
  link_click: 'Clique em atalho',
  copy_action: 'Copia de acao',
  cta_click: 'Clique em CTA',
  modal_open: 'Abertura de modal',
};

export const EDITOR_STEPS = [
  { id: 'basic', label: 'Identidade', description: 'Dados do tenant, contato, dominio e horarios.' },
  { id: 'visual', label: 'Visual', description: 'Logo, banner, favicon e midia principal.' },
  { id: 'content', label: 'Conteudo', description: 'Servicos, galeria e texto principal.' },
  { id: 'links', label: 'Links', description: 'Acessos rapidos e atalhos publicos.' },
  { id: 'payments', label: 'Pagamentos', description: 'PIX e Wi-Fi usados nas acoes do site.' },
  { id: 'settings', label: 'Configuracoes', description: 'SEO, tema, secoes, historico e analytics.' },
];

const customDomainPattern = /^(?!:\/\/)(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function humanizeToken(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getSectionDisplayLabel(section) {
  return SECTION_LABELS[section.key] || section.title || humanizeToken(section.key);
}

export function getSectionTypeLabel(section) {
  return SECTION_TYPE_LABELS[section.type] || humanizeToken(section.type);
}

export function getAnalyticsEventLabel(eventType) {
  return ANALYTICS_EVENT_LABELS[eventType] || humanizeToken(eventType);
}

export function formatAnalyticsTimestamp(value) {
  if (!value) {
    return 'Sem registro';
  }

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function getAnalyticsTargetSummary(event) {
  const pieces = [
    event.targetLabel || '',
    event.sectionType ? `Secao ${humanizeToken(event.sectionType)}` : '',
    event.targetType ? `Alvo ${humanizeToken(event.targetType)}` : '',
  ].filter(Boolean);

  return pieces.join(' - ') || 'Sem alvo detalhado';
}

export function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D+/g, '').slice(0, 13);
}

export function formatWhatsappValue(value) {
  const digits = normalizePhoneDigits(value);

  if (!digits) {
    return '';
  }

  const hasCountryCode = digits.startsWith('55') && digits.length > 11;
  const countryCode = hasCountryCode ? digits.slice(0, 2) : '';
  const localDigits = hasCountryCode ? digits.slice(2) : digits;
  const areaCode = localDigits.slice(0, 2);
  const prefixLength = localDigits.length > 10 ? 5 : 4;
  const prefix = localDigits.slice(2, 2 + prefixLength);
  const suffix = localDigits.slice(2 + prefixLength, 2 + prefixLength + 4);

  return [
    countryCode ? `+${countryCode}` : '',
    areaCode ? `(${areaCode})` : '',
    prefix,
    suffix ? `-${suffix}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(' -', '-');
}

function isValidHttpUrl(value) {
  if (!String(value || '').trim()) {
    return true;
  }

  try {
    const url = new URL(String(value).trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isValidLinkUrl(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return true;
  }

  if (normalized.startsWith('mailto:') || normalized.startsWith('tel:')) {
    return true;
  }

  return isValidHttpUrl(normalized);
}

export function formatHistoryValue(value) {
  if (value === undefined || value === null || value === '') {
    return 'vazio';
  }

  if (typeof value === 'string') {
    return value.length > 72 ? `${value.slice(0, 69)}...` : value;
  }

  const serialized = JSON.stringify(value);
  return serialized.length > 72 ? `${serialized.slice(0, 69)}...` : serialized;
}

export function getFieldStep(path) {
  if (path.startsWith('business.logoUrl') || path.startsWith('business.bannerUrl') || path.startsWith('business.seo.imageUrl')) {
    return 'visual';
  }

  if (path.startsWith('links.') || path.includes('primaryAction.href')) {
    return 'links';
  }

  if (path.startsWith('sections.gallery') || path.startsWith('sections.services')) {
    return 'content';
  }

  if (path.startsWith('business.contact.pix') || path.startsWith('business.contact.wifi')) {
    return 'payments';
  }

  if (path.startsWith('business.seo.') || path.startsWith('theme.') || path.startsWith('history.')) {
    return 'settings';
  }

  return 'basic';
}

export function buildValidationErrors(draft) {
  const errors = {};
  const whatsappDigits = normalizePhoneDigits(draft.business.contact?.whatsapp);
  const ctaLink = draft.sections.find((section) => section.key === 'cta')?.settings?.primaryAction?.href;

  if (!String(draft.business.name || '').trim()) {
    errors['business.name'] = 'Nome do comercio e obrigatorio.';
  }

  if (!slugify(draft.business.slug)) {
    errors['business.slug'] = 'Slug obrigatorio, em minusculas e sem espacos.';
  }

  if (whatsappDigits && (whatsappDigits.length < 10 || whatsappDigits.length > 13)) {
    errors['business.contact.whatsapp'] = 'Informe um WhatsApp valido com DDI e numero.';
  }

  if (draft.business.domains?.customDomain && !customDomainPattern.test(draft.business.domains.customDomain)) {
    errors['business.domains.customDomain'] = 'Informe um dominio customizado valido.';
  }

  [
    ['business.logoUrl', draft.business.logoUrl, 'Logo'],
    ['business.bannerUrl', draft.business.bannerUrl, 'Banner'],
    ['business.seo.imageUrl', draft.business.seo?.imageUrl, 'Icone do site'],
    ['cta.primaryAction.href', ctaLink, 'Link da assinatura'],
  ].forEach(([path, value, label]) => {
    if (value && !isValidHttpUrl(value)) {
      errors[path] = `${label} precisa ser uma URL valida.`;
    }
  });

  draft.links.forEach((link, index) => {
    if (link.url && !isValidLinkUrl(link.url)) {
      errors[`links.${index}.url`] = 'Use uma URL valida para este atalho.';
    }
  });

  draft.sections
    .filter((section) => section.key === 'gallery')
    .forEach((section) => {
      (section.items || []).forEach((item, index) => {
        if (item.imageUrl && !isValidHttpUrl(item.imageUrl)) {
          errors[`sections.gallery.${index}.imageUrl`] = 'A imagem da galeria precisa ser uma URL valida.';
        }
      });
    });

  return errors;
}

export function getInputState(error) {
  return {
    className: error ? 'admin-input--invalid' : '',
    'aria-invalid': Boolean(error),
  };
}

export async function uploadImageAndPatch(file, onUpload, options, onDone) {
  if (!file || !onUpload) {
    return;
  }

  const upload = await onUpload(file, options);
  onDone(upload);
}
