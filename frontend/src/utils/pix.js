function formatField(id, value) {
  const content = String(value || '');
  return `${id}${String(content.length).padStart(2, '0')}${content}`;
}

function normalizeAsciiText(value, maxLength, { uppercase = false } = {}) {
  const content = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

  return uppercase ? content.toUpperCase() : content;
}

function normalizePixAdditionalInfo(value, maxLength) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w .,:/+-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function resolvePixKeyType(keyType) {
  const normalized = String(keyType || '')
    .trim()
    .toLowerCase();

  if (['cpf', 'documento'].includes(normalized)) {
    return 'cpf';
  }

  if (['cnpj'].includes(normalized)) {
    return 'cnpj';
  }

  if (['telefone', 'phone', 'celular', 'mobile'].includes(normalized)) {
    return 'phone';
  }

  if (['email', 'e-mail', 'mail'].includes(normalized)) {
    return 'email';
  }

  if (['aleatoria', 'aleatoria-evp', 'random', 'evp', 'uuid'].includes(normalized)) {
    return 'random';
  }

  return normalized;
}

export function normalizePixKey(pix = {}) {
  const key = String(pix.key || '').trim();
  const keyType = resolvePixKeyType(pix.keyType);

  if (!key) {
    return '';
  }

  switch (keyType) {
    case 'cpf':
    case 'cnpj':
      return key.replace(/\D/g, '');
    case 'phone': {
      const digits = key.replace(/\D/g, '');

      if (!digits) {
        return '';
      }

      if (digits.startsWith('55')) {
        return `+${digits}`;
      }

      if (digits.length === 10 || digits.length === 11) {
        return `+55${digits}`;
      }

      return key.startsWith('+') ? `+${digits}` : `+${digits}`;
    }
    case 'email':
      return key.toLowerCase();
    default:
      return key;
  }
}

function normalizeTxId(value) {
  const txId = String(value || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 25);

  return txId || '***';
}

export function computeCrc16(payload) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixPayload(pix, amount) {
  const normalizedKey = normalizePixKey(pix);

  if (!normalizedKey) {
    return '';
  }

  const merchantName = normalizeAsciiText(pix.receiverName, 25) || 'Negocio Local';
  const merchantCity = normalizeAsciiText(pix.city, 15, { uppercase: true }) || 'SAO PAULO';
  const pixAmount =
    typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : null;
  const txId = normalizeTxId(pix.txId);

  const merchantAccountInfoParts = [
    formatField('00', 'br.gov.bcb.pix'),
    formatField('01', normalizedKey),
  ];

  const additionalInfoLimit = Math.max(
    0,
    99 - merchantAccountInfoParts.join('').length - 4,
  );
  const additionalInfo = normalizePixAdditionalInfo(
    pix.description,
    Math.min(72, additionalInfoLimit),
  );

  if (additionalInfo) {
    merchantAccountInfoParts.push(formatField('02', additionalInfo));
  }

  const payloadParts = [
    formatField('00', '01'),
    formatField('26', merchantAccountInfoParts.join('')),
    formatField('52', '0000'),
    formatField('53', '986'),
  ];

  if (pixAmount) {
    payloadParts.push(formatField('54', pixAmount));
  }

  payloadParts.push(
    formatField('58', 'BR'),
    formatField('59', merchantName),
    formatField('60', merchantCity),
    formatField('62', formatField('05', txId)),
    '6304',
  );

  const partialPayload = payloadParts.join('');
  return `${partialPayload}${computeCrc16(partialPayload)}`;
}

export function buildWifiPayload(wifi) {
  if (!wifi?.ssid || !wifi?.password) {
    return '';
  }

  return `WIFI:T:${wifi.security || 'WPA'};S:${wifi.ssid};P:${wifi.password};;`;
}
