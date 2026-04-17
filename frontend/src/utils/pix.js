function formatField(id, value) {
  const content = String(value || '');
  return `${id}${String(content.length).padStart(2, '0')}${content}`;
}

function normalizeMerchantValue(value, maxLength, fallback = '') {
  return String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, maxLength)
    .trim()
    .toUpperCase();
}

function computeCrc16(payload) {
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
  if (!pix?.key) {
    return '';
  }

  const merchantName = normalizeMerchantValue(pix.receiverName, 25, 'NEGOCIO LOCAL');
  const merchantCity = normalizeMerchantValue(pix.city, 15, 'SAO PAULO');
  const description = normalizeMerchantValue(pix.description, 72);
  const pixAmount =
    typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : null;

  const merchantAccountInfo = [formatField('00', 'br.gov.bcb.pix'), formatField('01', pix.key)];

  if (description) {
    merchantAccountInfo.push(formatField('02', description));
  }

  const payloadParts = [
    formatField('00', '01'),
    formatField('26', merchantAccountInfo.join('')),
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
    formatField('62', formatField('05', '***')),
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

