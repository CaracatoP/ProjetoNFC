import {
  getCanonicalSectionType,
  normalizeManagedLinkAction,
  normalizeManagedLinkActions,
  normalizeOptionalHost,
  slugify,
} from '@shared/utils/tenantIdentity.js';
import {
  DEFAULT_TENANT_THEME_COLORS,
  buildTenantTheme,
  buildThemeCssVariables,
  getContrastRatio,
  isHexColor as isValidHexColor,
  normalizeHexColor as normalizeThemeHexColor,
} from '@shared/utils/theme.js';
import { appConfig } from '@/config/appConfig.js';

export { normalizeOptionalHost, slugify };
export const THEME_COLOR_DEFAULTS = DEFAULT_TENANT_THEME_COLORS;
export const THEME_COLOR_PRESETS = [
  {
    id: 'classico',
    label: 'Classico',
    description: 'Laranja caloroso com apoio rosado e leitura aconchegante.',
    colors: {
      background: '#140d09',
      primary: '#f97316',
      secondary: '#fb7185',
      text: '#fff8f2',
    },
  },
  {
    id: 'escuro-premium',
    label: 'Escuro premium',
    description: 'Base marinho profunda com dourado sofisticado.',
    colors: {
      background: '#0d1321',
      primary: '#d4a24c',
      secondary: '#5b6cff',
      text: '#f5f1e8',
    },
  },
  {
    id: 'minimalista-claro',
    label: 'Minimalista claro',
    description: 'Clareza editorial com contraste elegante e limpo.',
    colors: {
      background: '#f5f1e8',
      primary: '#1f2937',
      secondary: '#0ea5e9',
      text: '#111827',
    },
  },
  {
    id: 'luxo-dourado',
    label: 'Luxo dourado',
    description: 'Carvao refinado com dourado quente para marcas premium.',
    colors: {
      background: '#120f0c',
      primary: '#c9a227',
      secondary: '#7a5c2e',
      text: '#fff7e6',
    },
  },
  {
    id: 'barbearia',
    label: 'Barbearia',
    description: 'Madeira escura com cobre e vinho para identidade classica.',
    colors: {
      background: '#0f0b09',
      primary: '#b08968',
      secondary: '#7f1d1d',
      text: '#f7f1e8',
    },
  },
  {
    id: 'acougue',
    label: 'Acougue',
    description: 'Vermelho marcante com fundo robusto para alto impacto.',
    colors: {
      background: '#1a0b0d',
      primary: '#d62828',
      secondary: '#f77f00',
      text: '#fff4ef',
    },
  },
  {
    id: 'restaurante',
    label: 'Restaurante',
    description: 'Paleta gastronomica com cobre, oliva e fundo intimista.',
    colors: {
      background: '#16110d',
      primary: '#c27c2c',
      secondary: '#7b9e45',
      text: '#fff7ee',
    },
  },
  {
    id: 'clinica',
    label: 'Clinica',
    description: 'Ambiente leve, confiavel e arejado para saude e bem-estar.',
    colors: {
      background: '#edf7f8',
      primary: '#0f766e',
      secondary: '#38bdf8',
      text: '#12343b',
    },
  },
  {
    id: 'loja-moderna',
    label: 'Loja moderna',
    description: 'Look digital com violeta, ciano e contraste nitido.',
    colors: {
      background: '#0b1020',
      primary: '#7c3aed',
      secondary: '#06b6d4',
      text: '#f8fafc',
    },
  },
];

export function normalizeSubdomainInput(value, options = {}) {
  return slugify(value, {
    maxLength: 63,
    ...options,
  });
}

export function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildDerivedTheme(theme, overrides) {
  return buildTenantTheme(theme, overrides);
}

export function applyThemePreset(theme, colors) {
  return buildTenantTheme(theme, colors);
}

export function buildThemePreviewCssVariables(theme) {
  return buildThemeCssVariables(buildTenantTheme(theme));
}

export function getThemeTextContrast(theme) {
  const resolvedTheme = buildTenantTheme(theme);
  return getContrastRatio(resolvedTheme.colors.background, resolvedTheme.colors.text);
}

export function isHexColor(value) {
  return isValidHexColor(value);
}

export function normalizeHexColor(value, fallback = '#000000') {
  return normalizeThemeHexColor(value, fallback);
}

function getEnvironmentOrigin(fallbackUrl = '') {
  const configuredPublicOrigin = String(appConfig.publicSiteBaseUrl || '').trim().replace(/\/$/, '');
  const browserOrigin = typeof window !== 'undefined' ? String(window.location.origin || '').replace(/\/$/, '') : '';

  try {
    if (configuredPublicOrigin) {
      return new URL(configuredPublicOrigin).origin;
    }
  } catch {
    // Ignore invalid frontend config and continue with safe fallbacks.
  }

  try {
    const fallback = new URL(fallbackUrl);

    if (fallback.pathname.startsWith('/site/')) {
      return fallback.origin;
    }
  } catch {
    // Ignore invalid fallback URLs and continue with browser/final fallback handling.
  }

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
  const normalizedSubdomain = normalizeSubdomainInput(subdomain);

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
  const subdomain = normalizeSubdomainInput(business.domains?.subdomain);
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
  const type = getCanonicalSectionType(key, fallbackType);

  if (existing) {
    existing.type = type;
    return existing;
  }

  const nextSection = {
    id: key,
    key,
    type,
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

function getManagedLinkAction(link) {
  const explicitAction = normalizeManagedLinkAction(link?.metadata?.action);

  if (explicitAction) {
    return explicitAction;
  }

  const url = String(link?.url || '').toLowerCase();
  const icon = String(link?.icon || '').toLowerCase();
  const type = String(link?.type || '').toLowerCase();

  if (icon === 'whatsapp' || url.startsWith('https://wa.me/')) {
    return 'whatsapp';
  }

  if (icon === 'phone' || url.startsWith('tel:')) {
    return 'phone';
  }

  if (icon === 'mail' || url.startsWith('mailto:')) {
    return 'email';
  }

  if (type === 'wifi') {
    return 'wifi';
  }

  if (type === 'pix') {
    return 'pix';
  }

  return '';
}

export function removeQuickActionFromDraft(draft, linkIndex) {
  const linkToRemove = draft.links[linkIndex];
  const managedAction = getManagedLinkAction(linkToRemove);

  draft.links = draft.links.filter((_, itemIndex) => itemIndex !== linkIndex);

  if (!managedAction) {
    return;
  }

  updateSectionDraft(draft, 'quick-actions', 'links', (section) => {
    section.settings = {
      ...(section.settings || {}),
      hiddenActions: normalizeManagedLinkActions([
        ...(section.settings?.hiddenActions || []),
        managedAction,
      ]),
    };
  });
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
  { id: 'settings', label: 'Configuracoes', description: 'SEO, tema, secoes e historico de alteracoes.' },
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

  draft.sections
    .filter((section) => section.key === 'services')
    .forEach((section) => {
      (section.items || []).forEach((item, index) => {
        if (item.imageUrl && !isValidHttpUrl(item.imageUrl)) {
          errors[`sections.services.${index}.imageUrl`] = 'A foto do servico precisa ser uma URL valida.';
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
