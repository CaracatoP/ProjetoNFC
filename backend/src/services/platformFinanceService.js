import {
  DEFAULT_PAYMENT_ARCHITECTURE,
  PAYMENT_ARCHITECTURES,
  PAYMENT_PROVIDERS,
} from '../../../shared/constants/index.js';
import {
  normalizeBusinessPaymentSettings,
  normalizePaymentArchitecture,
  resolveBusinessPaymentSettings,
} from '../../../shared/utils/businessPayment.js';
import { fromMoneyCents, toMoneyCents } from '../../../shared/utils/money.js';
import { env } from '../config/env.js';
import { getFinanceSettingsRecord, upsertFinanceSettingsRecord } from '../repositories/systemSettingRepository.js';

export const MAX_PLATFORM_FEE_PERCENT = 30;
export const FINANCE_REFUND_FEE_POLICIES = Object.freeze({
  KEEP_PLATFORM_FEE: 'keep_platform_fee',
  REVERSE_PLATFORM_FEE: 'reverse_platform_fee',
});

const VALID_WALLET_ID_PATTERN = /^[A-Za-z0-9_-]{6,120}$/;

export function normalizePlatformWalletId(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

export function normalizeStoredPlatformFeePercent(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > MAX_PLATFORM_FEE_PERCENT) {
    return 0;
  }

  return Number(numericValue.toFixed(2));
}

export function normalizeRefundFeePolicy(value) {
  return String(value || '').trim().toLowerCase() === FINANCE_REFUND_FEE_POLICIES.REVERSE_PLATFORM_FEE
    ? FINANCE_REFUND_FEE_POLICIES.REVERSE_PLATFORM_FEE
    : FINANCE_REFUND_FEE_POLICIES.KEEP_PLATFORM_FEE;
}

export function getStoredFinanceSettings(value = {}) {
  return {
    paymentArchitecture: normalizePaymentArchitecture(
      value?.paymentArchitecture,
      DEFAULT_PAYMENT_ARCHITECTURE,
    ),
    platformWalletId: normalizePlatformWalletId(value?.platformWalletId),
    defaultPlatformFeePercent: normalizeStoredPlatformFeePercent(value?.defaultPlatformFeePercent),
    refundFeePolicy: normalizeRefundFeePolicy(value?.refundFeePolicy),
  };
}

export async function getPlatformFinanceSettingsRecord() {
  return getFinanceSettingsRecord();
}

export async function getPlatformFinanceSettings() {
  const record = await getPlatformFinanceSettingsRecord();
  return getStoredFinanceSettings(record?.value);
}

export async function savePlatformFinanceSettings(value = {}) {
  const current = await getPlatformFinanceSettings();
  const nextValue = getStoredFinanceSettings({
    ...current,
    ...value,
  });
  const record = await upsertFinanceSettingsRecord(nextValue);
  return getStoredFinanceSettings(record?.value);
}

export function resolveAsaasIntegrationStatus() {
  if (!String(env.asaasApiKey || '').trim()) {
    return 'missing_api_key';
  }

  if (!String(env.asaasWebhookAuthToken || '').trim()) {
    return 'missing_webhook_auth_token';
  }

  return 'configured';
}

export function isAsaasIntegrationConfigured() {
  return resolveAsaasIntegrationStatus() === 'configured';
}

export function isValidWalletId(value) {
  const normalized = normalizePlatformWalletId(value);
  return Boolean(normalized) && VALID_WALLET_ID_PATTERN.test(normalized);
}

export function usesCentralizedPaymentArchitecture(financeSettings = {}) {
  return getStoredFinanceSettings(financeSettings).paymentArchitecture === PAYMENT_ARCHITECTURES.CENTRALIZED;
}

export function usesSubaccountPaymentArchitecture(financeSettings = {}) {
  return getStoredFinanceSettings(financeSettings).paymentArchitecture === PAYMENT_ARCHITECTURES.SUBACCOUNT;
}

export function calculatePlatformFeeBreakdown(amount, percent = 0) {
  const grossCents = toMoneyCents(amount);
  const normalizedPercent = normalizeStoredPlatformFeePercent(percent);
  const feeCents = Math.round((grossCents * normalizedPercent) / 100);
  const netCents = Math.max(0, grossCents - feeCents);

  return {
    grossAmount: fromMoneyCents(grossCents),
    platformFeePercent: normalizedPercent,
    platformFeeAmount: fromMoneyCents(feeCents),
    tenantNetAmount: fromMoneyCents(netCents),
  };
}

export function resolveEffectivePlatformFeePercent(paymentSettings = {}, financeSettings = {}) {
  const normalizedPaymentSettings = normalizeBusinessPaymentSettings(paymentSettings, {}, { mode: 'storage' });
  const normalizedFinanceSettings = getStoredFinanceSettings(financeSettings);
  const inheritsGlobal = normalizedPaymentSettings.split?.inheritsGlobal !== false;

  return inheritsGlobal
    ? normalizedFinanceSettings.defaultPlatformFeePercent
    : normalizeStoredPlatformFeePercent(normalizedPaymentSettings.split?.platformFeePercent);
}

export function resolveTenantFinancialStatus(
  paymentSettings = {},
  financeSettings = {},
) {
  const normalizedPaymentSettings = normalizeBusinessPaymentSettings(paymentSettings, {}, { mode: 'storage' });

  if (normalizedPaymentSettings.provider !== PAYMENT_PROVIDERS.ASAAS && !normalizedPaymentSettings.asaas?.enabled) {
    return 'manual';
  }

  if (usesCentralizedPaymentArchitecture(financeSettings)) {
    return isAsaasIntegrationConfigured() ? 'active' : 'pending';
  }

  const normalizedStatus = String(normalizedPaymentSettings.asaas?.status || '').trim().toLowerCase();
  const walletId = normalizePlatformWalletId(normalizedPaymentSettings.asaas?.walletId);
  const hasApiKey = Boolean(
    normalizedPaymentSettings.asaas?.hasApiKey || normalizedPaymentSettings.asaas?.apiKeyEncrypted,
  );

  if (!walletId) {
    return normalizedStatus || 'not_connected';
  }

  if (['pending', 'in_review', 'rejected', 'blocked', 'active'].includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return hasApiKey ? 'active' : 'pending';
}

export function resolveAsaasProviderContext({
  business = {},
  paymentSettings = null,
  financeSettings = {},
} = {}) {
  const normalizedFinanceSettings = getStoredFinanceSettings(financeSettings);
  const normalizedPaymentSettings =
    paymentSettings || resolveBusinessPaymentSettings(business, { mode: 'storage' });
  const paymentArchitecture = normalizedFinanceSettings.paymentArchitecture;
  const isEnabled =
    normalizedPaymentSettings.enabled &&
    normalizedPaymentSettings.provider === PAYMENT_PROVIDERS.ASAAS &&
    normalizedPaymentSettings.asaas?.enabled;

  if (!isEnabled) {
    return {
      paymentArchitecture,
      enabled: false,
      connected: false,
      usesCentralizedAccount: usesCentralizedPaymentArchitecture(normalizedFinanceSettings),
      apiKey: '',
      integrationStatus: resolveAsaasIntegrationStatus(),
    };
  }

  if (usesCentralizedPaymentArchitecture(normalizedFinanceSettings)) {
    return {
      paymentArchitecture,
      enabled: true,
      connected: isAsaasIntegrationConfigured(),
      usesCentralizedAccount: true,
      apiKey: env.asaasApiKey || '',
      integrationStatus: resolveAsaasIntegrationStatus(),
      tenantFinancialStatus: resolveTenantFinancialStatus(normalizedPaymentSettings, normalizedFinanceSettings),
      walletIdRequired: false,
      splitAllowed: false,
    };
  }

  return {
    paymentArchitecture,
    enabled: true,
    connected: Boolean(
      normalizedPaymentSettings.asaas?.apiKeyEncrypted &&
        normalizedPaymentSettings.asaas?.walletId &&
        isAsaasIntegrationConfigured(),
    ),
    usesCentralizedAccount: false,
    apiKey: normalizedPaymentSettings.asaas?.apiKeyEncrypted || '',
    integrationStatus: resolveAsaasIntegrationStatus(),
    tenantFinancialStatus: resolveTenantFinancialStatus(normalizedPaymentSettings, normalizedFinanceSettings),
    walletIdRequired: true,
    splitAllowed: true,
  };
}
