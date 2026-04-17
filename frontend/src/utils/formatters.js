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

