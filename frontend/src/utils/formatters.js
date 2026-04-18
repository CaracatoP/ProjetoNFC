import { appConfig } from '@/config/appConfig.js';

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

function resolveApiOrigin() {
  try {
    return new URL(appConfig.apiBaseUrl).origin;
  } catch {
    return '';
  }
}

export function resolveMediaUrl(value = '') {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  const apiOrigin = resolveApiOrigin();

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const parsedUrl = new URL(rawValue);
      const isLocalAddress = ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);

      if (isLocalAddress && apiOrigin) {
        return `${apiOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      }

      return parsedUrl.toString();
    } catch {
      return rawValue;
    }
  }

  if ((rawValue.startsWith('/uploads/') || rawValue.startsWith('uploads/')) && apiOrigin) {
    return `${apiOrigin}/${rawValue.replace(/^\/+/, '')}`;
  }

  return rawValue;
}
