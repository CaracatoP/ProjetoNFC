import { PAYMENT_PROVIDERS } from '../../../shared/constants/index.js';
import { resolveBusinessPaymentSettings } from '../../../shared/utils/businessPayment.js';
import { env } from '../config/env.js';
import { updateBusinessRecord } from '../repositories/adminRepository.js';
import { findBusinessById } from '../repositories/businessRepository.js';
import { getFinanceSettingsRecord, upsertFinanceSettingsRecord } from '../repositories/systemSettingRepository.js';
import { createAsaasSubaccount, validatePlatformFeePercent } from './asaasService.js';
import { encryptSecret } from '../utils/secretCrypto.js';
import { AppError } from '../utils/appError.js';

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function hasOwnProperty(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function normalizePlatformWalletId(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return Boolean(value);
}

export function normalizeStoredPlatformFeePercent(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 30) {
    return 0;
  }

  return Number(numericValue.toFixed(2));
}

export function getStoredFinanceSettings(value = {}) {
  return {
    platformWalletId: normalizePlatformWalletId(value?.platformWalletId),
    defaultPlatformFeePercent: normalizeStoredPlatformFeePercent(value?.defaultPlatformFeePercent),
  };
}

function resolveIntegrationStatus() {
  if (!String(env.asaasApiKey || '').trim()) {
    return 'missing_api_key';
  }

  if (!String(env.asaasWebhookAuthToken || '').trim()) {
    return 'missing_webhook_auth_token';
  }

  return 'configured';
}

export function buildFinanceSettingsDto(value = {}) {
  const settings = getStoredFinanceSettings(value);

  return {
    environment: env.asaasEnv,
    rootApiKeyConfigured: Boolean(String(env.asaasApiKey || '').trim()),
    platformWalletId: settings.platformWalletId,
    defaultPlatformFeePercent: settings.defaultPlatformFeePercent,
    webhookUrl: `${normalizeBaseUrl(env.apiPublicBaseUrl)}/api/webhooks/asaas`,
    integrationStatus: resolveIntegrationStatus(),
  };
}

export async function getAdminFinanceSettings() {
  const record = await getFinanceSettingsRecord();
  return buildFinanceSettingsDto(record?.value);
}

export async function updateAdminFinanceSettings(payload = {}) {
  const currentRecord = await getFinanceSettingsRecord();
  const nextSettings = getStoredFinanceSettings(currentRecord?.value);

  if (hasOwnProperty(payload, 'platformWalletId')) {
    nextSettings.platformWalletId = normalizePlatformWalletId(payload.platformWalletId);
  }

  if (hasOwnProperty(payload, 'defaultPlatformFeePercent')) {
    nextSettings.defaultPlatformFeePercent = validatePlatformFeePercent(payload.defaultPlatformFeePercent);
  }

  const updatedRecord = await upsertFinanceSettingsRecord(nextSettings);
  return buildFinanceSettingsDto(updatedRecord?.value);
}

export function resolveEffectiveAsaasSplitSettings(paymentSettings = {}, financeSettings = {}) {
  const normalizedPaymentSettings = resolveBusinessPaymentSettings({ paymentSettings }, { mode: 'storage' });
  const normalizedFinanceSettings = getStoredFinanceSettings(financeSettings);
  const split = normalizedPaymentSettings.split || {};
  const inheritsGlobal = split.inheritsGlobal !== false;
  const platformWalletId = normalizedFinanceSettings.platformWalletId;
  const globalPercent = normalizedFinanceSettings.defaultPlatformFeePercent;
  const tenantPercent = normalizeStoredPlatformFeePercent(split.platformFeePercent);
  const effectivePercent = inheritsGlobal ? globalPercent : tenantPercent;
  const enabled = Boolean(
    platformWalletId &&
      effectivePercent > 0 &&
      (inheritsGlobal ? globalPercent > 0 : normalizeBoolean(split.enabled, false)),
  );

  return {
    enabled,
    inheritsGlobal,
    platformWalletId,
    platformFeePercent: effectivePercent,
    defaultPlatformFeePercent: globalPercent,
    mode: 'percentage',
  };
}

function buildTenantFinanceDto(business, financeSettings = {}) {
  if (!business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  const paymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
  const effectiveSplit = resolveEffectiveAsaasSplitSettings(paymentSettings, financeSettings);

  return {
    businessId: String(business._id || business.id || ''),
    businessName: business.name || '',
    businessSlug: business.slug || '',
    enabled: Boolean(paymentSettings.enabled),
    provider: paymentSettings.provider || PAYMENT_PROVIDERS.MANUAL,
    methods: paymentSettings.methods || {},
    manualPixConfigured: Boolean(paymentSettings.pix?.key),
    asaas: {
      enabled: Boolean(paymentSettings.asaas?.enabled),
      connected: Boolean(paymentSettings.asaas?.connected),
      hasApiKey: Boolean(paymentSettings.asaas?.hasApiKey),
      walletId: paymentSettings.asaas?.walletId || '',
      accountEmail: paymentSettings.asaas?.accountEmail || '',
      accountName: paymentSettings.asaas?.accountName || '',
      status: paymentSettings.asaas?.status || 'not_connected',
      subaccountId: paymentSettings.asaas?.subaccountId || '',
      connectedAt: paymentSettings.asaas?.connectedAt || null,
    },
    split: {
      enabled: effectiveSplit.enabled,
      inheritsGlobal: effectiveSplit.inheritsGlobal,
      platformFeePercent: paymentSettings.split?.platformFeePercent || 0,
      effectivePlatformFeePercent: effectiveSplit.platformFeePercent,
      platformWalletConfigured: Boolean(effectiveSplit.platformWalletId),
      defaultPlatformFeePercent: effectiveSplit.defaultPlatformFeePercent,
      mode: effectiveSplit.mode,
    },
  };
}

export async function getAdminBusinessFinanceSettings(businessId) {
  const [business, financeRecord] = await Promise.all([
    findBusinessById(businessId),
    getFinanceSettingsRecord(),
  ]);

  return buildTenantFinanceDto(business, financeRecord?.value);
}

export async function updateAdminBusinessFinanceSettings(businessId, payload = {}) {
  const [existingBusiness, financeRecord] = await Promise.all([
    findBusinessById(businessId),
    getFinanceSettingsRecord(),
  ]);

  if (!existingBusiness) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  const currentSettings = resolveBusinessPaymentSettings(existingBusiness, { mode: 'storage' });
  const nextSettings = {
    ...currentSettings,
    methods: { ...(currentSettings.methods || {}) },
    pix: { ...(currentSettings.pix || {}) },
    asaas: { ...(currentSettings.asaas || {}) },
    split: { ...(currentSettings.split || {}) },
  };

  if (hasOwnProperty(payload, 'enabled')) {
    nextSettings.enabled = normalizeBoolean(payload.enabled, nextSettings.enabled);
  }

  if (hasOwnProperty(payload, 'provider')) {
    nextSettings.provider =
      String(payload.provider || '').trim().toLowerCase() || PAYMENT_PROVIDERS.MANUAL;
  }

  if (payload.methods && typeof payload.methods === 'object') {
    ['pix', 'creditCard', 'debitCard', 'cashOnPickup', 'cashOnDelivery'].forEach((key) => {
      if (hasOwnProperty(payload.methods, key)) {
        nextSettings.methods[key] = normalizeBoolean(payload.methods[key], nextSettings.methods[key]);
      }
    });
  }

  if (payload.asaas && typeof payload.asaas === 'object') {
    if (hasOwnProperty(payload.asaas, 'enabled')) {
      nextSettings.asaas.enabled = normalizeBoolean(payload.asaas.enabled, nextSettings.asaas.enabled);
    }

    ['subaccountId', 'walletId', 'accountEmail', 'accountName', 'status'].forEach((key) => {
      if (hasOwnProperty(payload.asaas, key)) {
        nextSettings.asaas[key] = normalizeOptionalString(payload.asaas[key]);
      }
    });

    if (hasOwnProperty(payload.asaas, 'apiKey')) {
      const nextApiKey = normalizeOptionalString(payload.asaas.apiKey);
      nextSettings.asaas.apiKeyEncrypted = nextApiKey ? encryptSecret(nextApiKey) : '';
    }

    if (normalizeBoolean(payload.asaas.clearApiKey, false)) {
      nextSettings.asaas.apiKeyEncrypted = '';
    }

    nextSettings.asaas.connectedAt =
      nextSettings.asaas.apiKeyEncrypted && nextSettings.asaas.walletId
        ? nextSettings.asaas.connectedAt || new Date()
        : null;
  }

  if (payload.split && typeof payload.split === 'object') {
    if (hasOwnProperty(payload.split, 'enabled')) {
      nextSettings.split.enabled = normalizeBoolean(payload.split.enabled, nextSettings.split.enabled);
    }

    if (hasOwnProperty(payload.split, 'inheritsGlobal')) {
      nextSettings.split.inheritsGlobal = normalizeBoolean(
        payload.split.inheritsGlobal,
        nextSettings.split.inheritsGlobal,
      );
    }

    if (hasOwnProperty(payload.split, 'platformFeePercent')) {
      nextSettings.split.platformFeePercent = validatePlatformFeePercent(payload.split.platformFeePercent);
    }
  }

  const financeSettings = getStoredFinanceSettings(financeRecord?.value);
  nextSettings.split.platformWalletId = financeSettings.platformWalletId;
  nextSettings.split.mode = 'percentage';

  const updatedBusiness = await updateBusinessRecord(businessId, {
    paymentSettings: nextSettings,
  });

  return buildTenantFinanceDto(updatedBusiness?.toObject?.() || updatedBusiness, financeRecord?.value);
}

export async function createAdminBusinessAsaasSubaccount(businessId, payload = {}) {
  const [existingBusiness, financeRecord] = await Promise.all([
    findBusinessById(businessId),
    getFinanceSettingsRecord(),
  ]);

  if (!existingBusiness) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  const createdSubaccount = await createAsaasSubaccount(payload);
  const currentSettings = resolveBusinessPaymentSettings(existingBusiness, { mode: 'storage' });
  const financeSettings = getStoredFinanceSettings(financeRecord?.value);

  const updatedBusiness = await updateBusinessRecord(businessId, {
    paymentSettings: {
      ...currentSettings,
      enabled: true,
      provider: PAYMENT_PROVIDERS.ASAAS,
      methods: {
        ...(currentSettings.methods || {}),
        pix: true,
      },
      asaas: {
        ...(currentSettings.asaas || {}),
        enabled: true,
        subaccountId: createdSubaccount.id,
        walletId: createdSubaccount.walletId,
        apiKeyEncrypted: encryptSecret(createdSubaccount.apiKey),
        accountEmail: normalizeOptionalString(payload.email),
        accountName: normalizeOptionalString(payload.name),
        status: 'active',
        connectedAt: new Date(),
      },
      split: {
        ...(currentSettings.split || {}),
        platformWalletId: financeSettings.platformWalletId,
        mode: 'percentage',
      },
    },
  });

  return buildTenantFinanceDto(updatedBusiness?.toObject?.() || updatedBusiness, financeRecord?.value);
}
