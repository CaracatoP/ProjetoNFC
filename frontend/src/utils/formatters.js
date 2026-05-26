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

function buildCloudinaryTransformations(options = {}) {
  const width = Number.isFinite(options.width) ? Math.max(1, Math.round(options.width)) : 0;
  const height = Number.isFinite(options.height) ? Math.max(1, Math.round(options.height)) : 0;

  if (!width && !height) {
    return '';
  }

  const fit = String(options.fit || (width && height ? 'fill' : 'limit')).trim().toLowerCase();
  const transformations = ['f_auto', 'q_auto', 'dpr_auto', `c_${fit}`];

  if (width) {
    transformations.push(`w_${width}`);
  }

  if (height) {
    transformations.push(`h_${height}`);
  }

  return transformations.join(',');
}

function optimizeCloudinaryImageUrl(value, options = {}) {
  const transformations = buildCloudinaryTransformations(options);

  if (!transformations || !value.includes('/image/upload/')) {
    return value;
  }

  return value.replace('/image/upload/', `/image/upload/${transformations}/`);
}

export function resolveMediaUrl(value = '', options = {}) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      return optimizeCloudinaryImageUrl(new URL(rawValue).toString(), options);
    } catch {
      return optimizeCloudinaryImageUrl(rawValue, options);
    }
  }

  return rawValue;
}
