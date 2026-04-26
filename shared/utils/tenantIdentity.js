export const CANONICAL_SECTION_TYPES_BY_KEY = {
  'hero-main': 'hero',
  'quick-actions': 'links',
  services: 'services',
  contact: 'contact',
  gallery: 'gallery',
  about: 'custom',
  pix: 'pix',
  cta: 'cta',
};

export const MANAGED_LINK_ACTIONS = ['whatsapp', 'phone', 'email', 'wifi', 'pix'];

export function slugify(value, { preserveTrailingSeparator = false, maxLength } = {}) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '');
  const withoutTrailingSeparator = preserveTrailingSeparator ? normalized : normalized.replace(/-+$/g, '');
  const limited = maxLength ? withoutTrailingSeparator.slice(0, maxLength) : withoutTrailingSeparator;

  return preserveTrailingSeparator ? limited : limited.replace(/-+$/g, '');
}

export function normalizeHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

export function normalizeOptionalHost(value) {
  return normalizeHost(value) || '';
}

export function normalizeOptionalString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

export function normalizePhoneActionValue(value, countryCode = '55') {
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

export function normalizeManagedLinkAction(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return MANAGED_LINK_ACTIONS.includes(normalized) ? normalized : '';
}

export function normalizeManagedLinkActions(values = []) {
  const source = Array.isArray(values) ? values : [values];
  return [...new Set(source.map((value) => normalizeManagedLinkAction(value)).filter(Boolean))];
}

export function getCanonicalSectionType(key, fallbackType = 'custom') {
  return CANONICAL_SECTION_TYPES_BY_KEY[key] || fallbackType;
}
