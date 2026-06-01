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

export function normalizePaymentMethod(value, fallback = DEFAULT_PAYMENT_METHOD) {
  const normalized = normalizeStringValue(value).toLowerCase();
  return PAYMENT_METHOD_VALUES.includes(normalized) ? normalized : fallback;
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

  return {
    pix: normalizeBooleanValue(methods.pix, Boolean(normalizedFallbackPix.key)),
    creditCard: normalizeBooleanValue(methods.creditCard, false),
    debitCard: normalizeBooleanValue(methods.debitCard, false),
    cashOnPickup: normalizeBooleanValue(methods.cashOnPickup, true),
    cashOnDelivery: normalizeBooleanValue(methods.cashOnDelivery, true),
  };
}

export function normalizeBusinessPaymentSettings(input = {}, fallbackPix = {}) {
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
  };
}

export function resolveBusinessPaymentSettings(business = {}) {
  return normalizeBusinessPaymentSettings(
    business.paymentSettings || {},
    business.contact?.pix || {},
  );
}

export function isBusinessPaymentMethodEnabled(settings, method) {
  const normalizedMethod = normalizePaymentMethod(method);
  const normalizedSettings = normalizeBusinessPaymentSettings(settings);

  if (!normalizedSettings.enabled) {
    return false;
  }

  switch (normalizedMethod) {
    case PAYMENT_METHODS.PIX:
      return normalizedSettings.methods.pix && Boolean(normalizedSettings.pix.key);
    case PAYMENT_METHODS.CREDIT_CARD:
      return normalizedSettings.methods.creditCard && normalizedSettings.provider !== PAYMENT_PROVIDERS.MANUAL;
    case PAYMENT_METHODS.DEBIT_CARD:
      return normalizedSettings.methods.debitCard && normalizedSettings.provider !== PAYMENT_PROVIDERS.MANUAL;
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
  const paidAt = payment.paidAt ? new Date(payment.paidAt) : null;

  return {
    method: normalizePaymentMethod(payment.method, DEFAULT_PAYMENT_METHOD),
    status: normalizePaymentStatus(payment.status, DEFAULT_PAYMENT_STATUS),
    provider: normalizePaymentProvider(payment.provider, DEFAULT_PAYMENT_PROVIDER),
    amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
    pixCopyPaste: normalizeStringValue(payment.pixCopyPaste),
    pixQrCodeUrl: normalizeStringValue(payment.pixQrCodeUrl),
    providerPaymentId: normalizeStringValue(payment.providerPaymentId),
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
  };
}
