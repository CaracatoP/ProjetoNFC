export function formatCurrency(value) {
  if (typeof value !== 'number') {
    return '';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function sanitizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

export function buildWhatsappUrl(value = '') {
  const sanitized = sanitizePhone(value);
  return sanitized ? `https://wa.me/${sanitized}` : '';
}

export function resolveMediaUrl(value = '') {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      return new URL(rawValue).toString();
    } catch {
      return rawValue;
    }
  }

  return rawValue;
}
