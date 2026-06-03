import {
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_PAYMENT_PROVIDER,
  DEFAULT_PAYMENT_STATUS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_VALUES,
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_VALUES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
} from '../constants/payments.js';

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeStringValue(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeBooleanValue(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return Boolean(value);
}

function normalizeDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeNumberValue(value, fallback = 0, { min = null, max = null } = {}) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const normalized = Number(numericValue.toFixed(2));

  if (min !== null && normalized < min) {
    return fallback;
  }

  if (max !== null && normalized > max) {
    return fallback;
  }

  return normalized;
}

function normalizeMercadoPagoSettings(input = {}, options = {}) {
  const mercadoPago = isPlainObject(input) ? input : {};
  const mode = options.mode || 'safe';
  const enabled = normalizeBooleanValue(mercadoPago.enabled, false);
  const publicKey = normalizeStringValue(mercadoPago.publicKey);
  const accountEmail = normalizeStringValue(mercadoPago.accountEmail).toLowerCase();
  const accessTokenEncrypted = normalizeStringValue(mercadoPago.accessTokenEncrypted);
  const webhookSecretEncrypted = normalizeStringValue(mercadoPago.webhookSecretEncrypted);
  const connectedAt = normalizeDateValue(mercadoPago.connectedAt);
  const hasAccessToken = Boolean(
    accessTokenEncrypted || normalizeBooleanValue(mercadoPago.hasAccessToken, false),
  );
  const hasWebhookSecret = Boolean(
    webhookSecretEncrypted || normalizeBooleanValue(mercadoPago.hasWebhookSecret, false),
  );
  const connected = Boolean(
    hasAccessToken || normalizeBooleanValue(mercadoPago.connected, false),
  );

  const safeSettings = {
    enabled,
    publicKey,
    accountEmail,
    connected,
    hasAccessToken,
    hasWebhookSecret,
  };

  if (mode === 'storage') {
    return {
      ...safeSettings,
      accessTokenEncrypted,
      webhookSecretEncrypted,
      connectedAt,
    };
  }

  return safeSettings;
}

function normalizeAsaasSettings(input = {}, options = {}) {
  const asaas = isPlainObject(input) ? input : {};
  const mode = options.mode || 'safe';
  const enabled = normalizeBooleanValue(asaas.enabled, false);
  const subaccountId = normalizeStringValue(asaas.subaccountId);
  const walletId = normalizeStringValue(asaas.walletId);
  const accountEmail = normalizeStringValue(asaas.accountEmail).toLowerCase();
  const accountName = normalizeStringValue(asaas.accountName);
  const status = normalizeStringValue(asaas.status, 'not_connected') || 'not_connected';
  const connectedAt = normalizeDateValue(asaas.connectedAt);
  const apiKeyEncrypted = normalizeStringValue(asaas.apiKeyEncrypted);
  const webhookAuthTokenEncrypted = normalizeStringValue(asaas.webhookAuthTokenEncrypted);
  const hasApiKey = Boolean(apiKeyEncrypted || normalizeBooleanValue(asaas.hasApiKey, false));
  const hasWebhookAuthToken = Boolean(
    webhookAuthTokenEncrypted || normalizeBooleanValue(asaas.hasWebhookAuthToken, false),
  );
  const connected = Boolean(
    normalizeBooleanValue(asaas.connected, false) || (enabled && walletId && hasApiKey),
  );

  const safeSettings = {
    enabled,
    subaccountId,
    walletId,
    accountEmail,
    accountName,
    status,
    connectedAt,
    hasApiKey,
    hasWebhookAuthToken,
    connected,
  };

  if (mode === 'storage') {
    return {
      ...safeSettings,
      apiKeyEncrypted,
      webhookAuthTokenEncrypted,
    };
  }

  return safeSettings;
}

function normalizeBusinessPaymentSplit(input = {}, options = {}) {
  const split = isPlainObject(input) ? input : {};
  const fallbackWalletId = normalizeStringValue(options.platformWalletId);

  return {
    enabled: normalizeBooleanValue(split.enabled, false),
    platformFeePercent: normalizeNumberValue(split.platformFeePercent, 0, { min: 0, max: 30 }),
    platformWalletId: normalizeStringValue(split.platformWalletId || fallbackWalletId),
    mode: normalizeStringValue(split.mode, 'percentage') || 'percentage',
    inheritsGlobal: normalizeBooleanValue(split.inheritsGlobal, true),
  };
}

export function normalizePaymentMethod(value, fallback = DEFAULT_PAYMENT_METHOD) {
  const normalized = normalizeStringValue(value).toLowerCase();
  return PAYMENT_METHOD_VALUES.includes(normalized) ? normalized : fallback;
}

export function normalizeLegacyPaymentMethodAlias(method, deliveryType, enabledMethods = {}) {
  const normalizedMethod = normalizeStringValue(method).toLowerCase();
  const normalizedDeliveryType = normalizeStringValue(deliveryType).toLowerCase();
  const hasEnabledMethods = Object.values(enabledMethods || {}).some(Boolean);

  if (!normalizedMethod) {
    return '';
  }

  if (normalizedMethod === 'cash' || normalizedMethod === 'money') {
    if (normalizedDeliveryType === 'delivery') {
      return PAYMENT_METHODS.CASH_ON_DELIVERY;
    }

    if (normalizedDeliveryType === 'pickup') {
      return PAYMENT_METHODS.CASH_ON_PICKUP;
    }

    return '';
  }

  if (normalizedMethod === 'card') {
    if (enabledMethods.creditCard) {
      return PAYMENT_METHODS.CREDIT_CARD;
    }

    if (enabledMethods.debitCard) {
      return PAYMENT_METHODS.DEBIT_CARD;
    }

    if (!hasEnabledMethods) {
      return normalizedMethod;
    }
  }

  if (normalizedMethod === 'online') {
    if (enabledMethods.pix) {
      return PAYMENT_METHODS.PIX;
    }

    if (enabledMethods.creditCard) {
      return PAYMENT_METHODS.CREDIT_CARD;
    }

    if (enabledMethods.debitCard) {
      return PAYMENT_METHODS.DEBIT_CARD;
    }

    if (!hasEnabledMethods) {
      return normalizedMethod;
    }
  }

  return normalizePaymentMethod(normalizedMethod, '');
}

export function normalizePaymentStatus(value, fallback = DEFAULT_PAYMENT_STATUS) {
  const normalized = normalizeStringValue(value).toLowerCase();
  return PAYMENT_STATUS_VALUES.includes(normalized) ? normalized : fallback;
}

export function normalizePaymentProvider(value, fallback = DEFAULT_PAYMENT_PROVIDER) {
  const normalized = normalizeStringValue(value).toLowerCase();
  return PAYMENT_PROVIDER_VALUES.includes(normalized) ? normalized : fallback;
}

export function normalizeBusinessPaymentPix(input = {}, fallbackPix = {}) {
  const pix = isPlainObject(input) ? input : {};
  const legacyPix = isPlainObject(fallbackPix) ? fallbackPix : {};

  return {
    key: normalizeStringValue(pix.key || legacyPix.key),
    merchantName: normalizeStringValue(pix.merchantName || legacyPix.receiverName),
    merchantCity: normalizeStringValue(pix.merchantCity || legacyPix.city),
  };
}

export function normalizeBusinessPaymentMethods(input = {}, fallbackPix = {}) {
  const methods = isPlainObject(input) ? input : {};
  const normalizedFallbackPix = normalizeBusinessPaymentPix({}, fallbackPix);
  const legacyCashEnabled =
    normalizeBooleanValue(methods.cash, false) || normalizeBooleanValue(methods.money, false);
  const legacyCardEnabled = normalizeBooleanValue(methods.card, false);
  const legacyOnlineEnabled = normalizeBooleanValue(methods.online, false);

  return {
    pix: normalizeBooleanValue(methods.pix, Boolean(normalizedFallbackPix.key) || legacyOnlineEnabled),
    creditCard: normalizeBooleanValue(methods.creditCard, legacyCardEnabled || legacyOnlineEnabled),
    debitCard: normalizeBooleanValue(methods.debitCard, legacyCardEnabled || legacyOnlineEnabled),
    cashOnPickup: normalizeBooleanValue(methods.cashOnPickup, true),
    cashOnDelivery: normalizeBooleanValue(methods.cashOnDelivery, true),
  };
}

export function normalizeBusinessPaymentSettings(input = {}, fallbackPix = {}, options = {}) {
  const settings = isPlainObject(input) ? input : {};
  const pix = normalizeBusinessPaymentPix(settings.pix, fallbackPix);
  const methods = normalizeBusinessPaymentMethods(settings.methods, fallbackPix);
  const provider = normalizePaymentProvider(settings.provider, DEFAULT_PAYMENT_PROVIDER);
  const enabledFallback =
    methods.pix || methods.cashOnPickup || methods.cashOnDelivery || methods.creditCard || methods.debitCard;

  return {
    enabled: normalizeBooleanValue(settings.enabled, enabledFallback),
    methods,
    pix,
    provider,
    mercadoPago: normalizeMercadoPagoSettings(settings.mercadoPago, options),
    asaas: normalizeAsaasSettings(settings.asaas, options),
    split: normalizeBusinessPaymentSplit(settings.split, {
      platformWalletId: settings?.split?.platformWalletId,
    }),
  };
}

export function resolveBusinessPaymentSettings(business = {}, options = {}) {
  return normalizeBusinessPaymentSettings(
    business.paymentSettings || {},
    business.contact?.pix || {},
    options,
  );
}

export function isBusinessPaymentMethodEnabled(settings, method) {
  const normalizedMethod = normalizePaymentMethod(method);
  const normalizedSettings = normalizeBusinessPaymentSettings(settings);
  const onlineProviderEnabled =
    normalizedSettings.provider !== PAYMENT_PROVIDERS.MANUAL &&
    (normalizedSettings.mercadoPago?.enabled ||
      normalizedSettings.asaas?.enabled);

  if (!normalizedSettings.enabled) {
    return false;
  }

  switch (normalizedMethod) {
    case PAYMENT_METHODS.PIX:
      return normalizedSettings.methods.pix && (Boolean(normalizedSettings.pix.key) || onlineProviderEnabled);
    case PAYMENT_METHODS.CREDIT_CARD:
      return normalizedSettings.methods.creditCard && onlineProviderEnabled;
    case PAYMENT_METHODS.DEBIT_CARD:
      return normalizedSettings.methods.debitCard && onlineProviderEnabled;
    case PAYMENT_METHODS.CASH_ON_PICKUP:
      return normalizedSettings.methods.cashOnPickup;
    case PAYMENT_METHODS.CASH_ON_DELIVERY:
      return normalizedSettings.methods.cashOnDelivery;
    default:
      return false;
  }
}

export function resolveDefaultPaymentMethod(settings) {
  const normalizedSettings = normalizeBusinessPaymentSettings(settings);
  const orderedMethods = [
    PAYMENT_METHODS.CASH_ON_PICKUP,
    PAYMENT_METHODS.CASH_ON_DELIVERY,
    PAYMENT_METHODS.PIX,
    PAYMENT_METHODS.CREDIT_CARD,
    PAYMENT_METHODS.DEBIT_CARD,
  ];

  return orderedMethods.find((method) => isBusinessPaymentMethodEnabled(normalizedSettings, method)) || null;
}

export function normalizeOrderPayment(input = {}, fallbackAmount = 0) {
  const payment = isPlainObject(input) ? input : {};
  const amount = Number(payment.amount ?? fallbackAmount ?? 0);
  const platformFeeAmount = Number(payment.platformFeeAmount ?? 0);
  const tenantNetAmount = Number(payment.tenantNetAmount ?? Math.max(0, amount - platformFeeAmount));
  const paidAt = payment.paidAt ? new Date(payment.paidAt) : null;
  const updatedAt = payment.updatedAt ? new Date(payment.updatedAt) : null;

  return {
    method: normalizePaymentMethod(payment.method, DEFAULT_PAYMENT_METHOD),
    status: normalizePaymentStatus(payment.status, DEFAULT_PAYMENT_STATUS),
    provider: normalizePaymentProvider(payment.provider, DEFAULT_PAYMENT_PROVIDER),
    amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
    platformFeeAmount: Number.isFinite(platformFeeAmount) ? Number(platformFeeAmount.toFixed(2)) : 0,
    tenantNetAmount: Number.isFinite(tenantNetAmount) ? Number(tenantNetAmount.toFixed(2)) : 0,
    pixCopyPaste: normalizeStringValue(payment.pixCopyPaste),
    pixQrCodeUrl: normalizeStringValue(payment.pixQrCodeUrl),
    pixQrCode: normalizeStringValue(payment.pixQrCode),
    providerPaymentId: normalizeStringValue(payment.providerPaymentId),
    providerCustomerId: normalizeStringValue(payment.providerCustomerId),
    providerPreferenceId: normalizeStringValue(payment.providerPreferenceId),
    checkoutUrl: normalizeStringValue(payment.checkoutUrl),
    invoiceUrl: normalizeStringValue(payment.invoiceUrl),
    bankSlipUrl: normalizeStringValue(payment.bankSlipUrl),
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
    updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
  };
}

export function normalizeOrderPaymentEvent(input = {}) {
  const event = isPlainObject(input) ? input : {};

  return {
    type: normalizeStringValue(event.type),
    provider: normalizePaymentProvider(event.provider, DEFAULT_PAYMENT_PROVIDER),
    status: normalizePaymentStatus(event.status, DEFAULT_PAYMENT_STATUS),
    message: normalizeStringValue(event.message),
    providerEvent: normalizeStringValue(event.providerEvent),
    providerPaymentId: normalizeStringValue(event.providerPaymentId),
    occurredAt: normalizeDateValue(event.occurredAt),
    meta: isPlainObject(event.meta) ? event.meta : {},
  };
}

export function normalizeOrderPaymentEvents(input = []) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((event) => normalizeOrderPaymentEvent(event))
    .filter((event) => Boolean(event.type));
}
