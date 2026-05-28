function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeStringValue(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

export function normalizeBusinessWifi(input = {}) {
  const wifi = isPlainObject(input) ? input : {};

  return {
    ssid: normalizeStringValue(wifi.ssid),
    password: normalizeStringValue(wifi.password),
    security: normalizeStringValue(wifi.security, 'WPA') || 'WPA',
    title: normalizeStringValue(wifi.title),
    description: normalizeStringValue(wifi.description),
  };
}

export function normalizeBusinessPix(input = {}) {
  const pix = isPlainObject(input) ? input : {};
  const normalizedPix = {
    keyType: normalizeStringValue(pix.keyType),
    key: normalizeStringValue(pix.key),
    receiverName: normalizeStringValue(pix.receiverName),
    city: normalizeStringValue(pix.city),
    description: normalizeStringValue(pix.description),
    actionLabel: normalizeStringValue(pix.actionLabel),
    actionDescription: normalizeStringValue(pix.actionDescription),
  };

  return normalizedPix.key ? normalizedPix : undefined;
}

export function normalizeBusinessContact(input = {}) {
  const contact = isPlainObject(input) ? input : {};

  return {
    whatsapp: normalizeStringValue(contact.whatsapp),
    phone: normalizeStringValue(contact.phone),
    email: normalizeStringValue(contact.email),
    wifi: normalizeBusinessWifi(contact.wifi),
    pix: normalizeBusinessPix(contact.pix),
  };
}
