import { PAYMENT_PROVIDERS, PAYMENT_PROVIDER_LABELS } from '../../../shared/constants/index.js';
import { resolveBusinessPaymentSettings } from '../../../shared/utils/businessPayment.js';
import { env } from '../config/env.js';
import { updateBusinessRecord } from '../repositories/adminRepository.js';
import { findBusinessById } from '../repositories/businessRepository.js';
import { getFinanceSettingsRecord, upsertFinanceSettingsRecord } from '../repositories/systemSettingRepository.js';
import { createAsaasSubaccount, testAsaasConnection, validatePlatformFeePercent } from './asaasService.js';
import { encryptSecret } from '../utils/secretCrypto.js';
import { AppError } from '../utils/appError.js';

export const MAX_PLATFORM_FEE_PERCENT = 30;
export const ASAAS_SUBACCOUNT_COMPANY_TYPES = Object.freeze(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION']);

const VALID_WALLET_ID_PATTERN = /^[A-Za-z0-9_-]{6,120}$/;
const TENANT_FINANCIAL_STATUS_LABELS = Object.freeze({
  active: 'Ativo',
  pending: 'Pendente',
  in_review: 'Em analise',
  rejected: 'Rejeitada',
  blocked: 'Bloqueada',
  not_connected: 'Nao conectada',
  manual: 'Manual',
});
const INTEGRATION_STATUS_LABELS = Object.freeze({
  configured: 'Configurado',
  missing_api_key: 'API ausente',
  missing_webhook_auth_token: 'Webhook ausente',
  invalid_credentials: 'Credenciais invalidas',
  webhook_error: 'Webhook com erro',
});

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

function normalizeDigits(value) {
  return normalizeOptionalString(value).replace(/\D/g, '');
}

function normalizeBrazilianPhoneDigits(value) {
  const digits = normalizeDigits(value);

  if (digits.startsWith('55') && [12, 13].includes(digits.length)) {
    return digits.slice(2);
  }

  return digits;
}

function normalizeEmail(value) {
  return normalizeOptionalString(value).toLowerCase();
}

function normalizeCompanyType(value) {
  return normalizeOptionalString(value).toUpperCase();
}

function normalizeIncomeValue(value) {
  if (value === '' || value === undefined || value === null) {
    return 0;
  }

  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function isValidUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const parsedUrl = new URL(value);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (_error) {
    return false;
  }
}

function createSubaccountValidationError(message, field) {
  const error = new AppError(message, 422, 'SUBACCOUNT_VALIDATION_ERROR', [
    {
      path: field,
      field,
      message,
    },
  ]);
  error.field = field;
  return error;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return Boolean(value);
}

export function normalizeStoredPlatformFeePercent(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > MAX_PLATFORM_FEE_PERCENT) {
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

function isIntegrationConfigured(integrationStatus) {
  return integrationStatus === 'configured';
}

function isValidWalletId(value) {
  const normalized = normalizePlatformWalletId(value);
  return Boolean(normalized) && VALID_WALLET_ID_PATTERN.test(normalized);
}

function resolveTenantFinancialStatus(paymentSettings = {}) {
  const normalizedStatus = normalizeOptionalString(paymentSettings.asaas?.status).toLowerCase();
  const walletId = normalizePlatformWalletId(paymentSettings.asaas?.walletId);
  const hasApiKey = Boolean(paymentSettings.asaas?.hasApiKey || paymentSettings.asaas?.apiKeyEncrypted);
  const provider = paymentSettings.provider || PAYMENT_PROVIDERS.MANUAL;
  const enabled = Boolean(paymentSettings.asaas?.enabled);

  if (provider !== PAYMENT_PROVIDERS.ASAAS && !enabled && !walletId) {
    return 'manual';
  }

  if (!walletId) {
    return normalizedStatus || 'not_connected';
  }

  if (['pending', 'in_review', 'rejected', 'blocked', 'active'].includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return hasApiKey ? 'active' : 'pending';
}

function hasValidAsaasSubaccountLink(asaasSettings = {}) {
  return Boolean(
    normalizePlatformWalletId(asaasSettings.walletId) ||
      normalizeOptionalString(asaasSettings.subaccountId) ||
      normalizeOptionalString(asaasSettings.apiKeyEncrypted) ||
      normalizeBoolean(asaasSettings.connected, false),
  );
}

export function buildAsaasSubaccountPayload(payload = {}) {
  const cpfCnpj = normalizeDigits(payload.cpfCnpj);
  const companyType = normalizeCompanyType(payload.companyType);
  const incomeValue = normalizeIncomeValue(payload.incomeValue);
  const phone = normalizeBrazilianPhoneDigits(payload.phone);
  const mobilePhone = normalizeBrazilianPhoneDigits(payload.mobilePhone);
  const postalCode = normalizeDigits(payload.postalCode);
  const site = normalizeOptionalString(payload.site);
  const subaccountPayload = {
    name: normalizeOptionalString(payload.name),
    email: normalizeEmail(payload.email),
    cpfCnpj,
    companyType,
    mobilePhone,
    incomeValue,
    address: normalizeOptionalString(payload.address),
    addressNumber: normalizeOptionalString(payload.addressNumber),
    province: normalizeOptionalString(payload.province),
    postalCode,
  };

  if (phone) {
    subaccountPayload.phone = phone;
  }

  if (site) {
    subaccountPayload.site = site;
  }

  const complement = normalizeOptionalString(payload.complement);
  if (complement) {
    subaccountPayload.complement = complement;
  }

  return subaccountPayload;
}

export function validateAsaasSubaccountPayload(payload = {}) {
  const documentDigits = normalizeDigits(payload.cpfCnpj);

  if (!normalizeOptionalString(payload.name) || normalizeOptionalString(payload.name).length < 2) {
    throw createSubaccountValidationError('Informe o nome da conta.', 'name');
  }

  if (!isValidEmail(payload.email)) {
    throw createSubaccountValidationError('Informe um e-mail valido.', 'email');
  }

  if (!documentDigits) {
    throw createSubaccountValidationError('Informe o CNPJ da subconta Asaas.', 'cpfCnpj');
  }

  if (documentDigits.length === 11) {
    throw createSubaccountValidationError('Use um CNPJ para criar subconta Asaas neste fluxo.', 'cpfCnpj');
  }

  if (documentDigits.length !== 14) {
    throw createSubaccountValidationError('Informe um CNPJ valido com 14 digitos.', 'cpfCnpj');
  }

  if (!payload.companyType) {
    throw createSubaccountValidationError('Selecione o tipo de empresa.', 'companyType');
  }

  if (!ASAAS_SUBACCOUNT_COMPANY_TYPES.includes(normalizeCompanyType(payload.companyType))) {
    throw createSubaccountValidationError('Selecione um tipo de empresa valido.', 'companyType');
  }

  if (normalizeIncomeValue(payload.incomeValue) <= 0) {
    throw createSubaccountValidationError('Informe o faturamento mensal da subconta.', 'incomeValue');
  }

  const mobilePhoneDigits = normalizeBrazilianPhoneDigits(payload.mobilePhone);
  if (mobilePhoneDigits.length < 10 || mobilePhoneDigits.length > 11) {
    throw createSubaccountValidationError('Informe um celular valido.', 'mobilePhone');
  }

  const phoneDigits = normalizeBrazilianPhoneDigits(payload.phone);
  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
    throw createSubaccountValidationError('Informe um telefone fixo valido.', 'phone');
  }

  if (!normalizeOptionalString(payload.address)) {
    throw createSubaccountValidationError('Informe o logradouro.', 'address');
  }

  if (!normalizeOptionalString(payload.addressNumber)) {
    throw createSubaccountValidationError('Informe o numero do endereco.', 'addressNumber');
  }

  if (!normalizeOptionalString(payload.province)) {
    throw createSubaccountValidationError('Informe o bairro.', 'province');
  }

  if (normalizeDigits(payload.postalCode).length !== 8) {
    throw createSubaccountValidationError('Informe um CEP valido com 8 digitos.', 'postalCode');
  }

  if (!isValidUrl(normalizeOptionalString(payload.site))) {
    throw createSubaccountValidationError('Informe uma URL valida para o site.', 'site');
  }

  return true;
}

function sanitizeAsaasSubaccountProviderError(error) {
  const statusCode = error?.statusCode && error.statusCode < 500 ? error.statusCode : 502;
  const providerDetails = Array.isArray(error?.details)
    ? error.details.map((detail) => ({
        provider: 'asaas',
        status: detail?.status || error.statusCode || 502,
        code: detail?.code || error.code || 'asaas_error',
        message: detail?.message || detail?.description || error.message || 'Falha na Asaas.',
        field: detail?.field,
      }))
    : [];
  const firstDetail = providerDetails[0];
  const field = firstDetail?.field;
  const fallbackMessage = error?.message || 'Nao foi possivel criar a subconta Asaas.';
  const message =
    field === 'companyType'
      ? 'Selecione o tipo de empresa para criar a subconta Asaas.'
      : fallbackMessage;
  const safeError = new AppError(
    message,
    statusCode,
    'SUBACCOUNT_PROVIDER_ERROR',
    providerDetails.length
      ? providerDetails
      : [
          {
            provider: 'asaas',
            status: error?.statusCode || 502,
            code: error?.code || 'asaas_error',
            message,
          },
        ],
  );

  if (field) {
    safeError.field = field;
  }

  return safeError;
}

function resolveWarnings({
  integrationStatus,
  tenantFinancialStatus,
  provider,
  platformWalletId,
  tenantWalletId,
  usesGlobalFee,
  splitRequested,
}) {
  const warnings = [];

  if (provider === PAYMENT_PROVIDERS.ASAAS && !isIntegrationConfigured(integrationStatus)) {
    warnings.push('Integracao global do Asaas ainda nao esta valida.');
  }

  if (provider === PAYMENT_PROVIDERS.ASAAS && !tenantWalletId) {
    warnings.push('Tenant sem walletId valida para operacoes Asaas.');
  }

  if (provider === PAYMENT_PROVIDERS.ASAAS && tenantFinancialStatus !== 'active') {
    warnings.push('Subconta Asaas ainda nao esta ativa para checkout online.');
  }

  if ((splitRequested || usesGlobalFee) && !platformWalletId) {
    warnings.push('Wallet da plataforma ausente para aplicar split.');
  }

  return warnings;
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
  const integrationStatus = resolveIntegrationStatus();

  return {
    environment: env.asaasEnv,
    rootApiKeyConfigured: Boolean(String(env.asaasApiKey || '').trim()),
    platformWalletId: settings.platformWalletId,
    defaultPlatformFeePercent: settings.defaultPlatformFeePercent,
    webhookUrl: `${normalizeBaseUrl(env.apiPublicBaseUrl)}/api/webhooks/asaas`,
    integrationStatus,
    summary: {
      platformReady: isIntegrationConfigured(integrationStatus) && isValidWalletId(settings.platformWalletId),
    },
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

export async function testAdminAsaasConnection() {
  return testAsaasConnection({
    apiKey: env.asaasApiKey || process.env.ASAAS_API_KEY || '',
  });
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
  const integrationStatus = resolveIntegrationStatus();
  const tenantFinancialStatus = resolveTenantFinancialStatus(paymentSettings);
  const platformWalletId = normalizePlatformWalletId(effectiveSplit.platformWalletId);
  const tenantWalletId = normalizePlatformWalletId(paymentSettings.asaas?.walletId);
  const usesGlobalFee = effectiveSplit.inheritsGlobal !== false;
  const effectivePlatformFeePercent = normalizeStoredPlatformFeePercent(effectiveSplit.platformFeePercent);
  const canEnableSplit = Boolean(
    paymentSettings.provider === PAYMENT_PROVIDERS.ASAAS &&
      isIntegrationConfigured(integrationStatus) &&
      tenantFinancialStatus === 'active' &&
      isValidWalletId(platformWalletId) &&
      isValidWalletId(tenantWalletId),
  );
  const splitActive = Boolean(
    canEnableSplit &&
      effectivePlatformFeePercent > 0 &&
      (usesGlobalFee ? true : normalizeBoolean(paymentSettings.split?.enabled, false)),
  );
  const canEnableCheckout = Boolean(
    paymentSettings.provider !== PAYMENT_PROVIDERS.ASAAS ||
      (isIntegrationConfigured(integrationStatus) &&
        tenantFinancialStatus === 'active' &&
        isValidWalletId(tenantWalletId) &&
        (!splitActive || canEnableSplit)),
  );
  const warnings = resolveWarnings({
    integrationStatus,
    tenantFinancialStatus,
    provider: paymentSettings.provider,
    platformWalletId,
    tenantWalletId,
    usesGlobalFee,
    splitRequested: normalizeBoolean(paymentSettings.split?.enabled, false),
  });

  return {
    businessId: String(business._id || business.id || ''),
    businessName: business.name || '',
    businessSlug: business.slug || '',
    enabled: Boolean(paymentSettings.enabled),
    provider: paymentSettings.provider || PAYMENT_PROVIDERS.MANUAL,
    integrationStatus,
    tenantFinancialStatus,
    methods: paymentSettings.methods || {},
    manualPixConfigured: Boolean(paymentSettings.pix?.key),
    asaas: {
      enabled: Boolean(paymentSettings.asaas?.enabled),
      connected: Boolean(paymentSettings.asaas?.connected),
      hasApiKey: Boolean(paymentSettings.asaas?.hasApiKey),
      walletId: paymentSettings.asaas?.walletId || '',
      accountEmail: paymentSettings.asaas?.accountEmail || '',
      accountName: paymentSettings.asaas?.accountName || '',
      companyType: paymentSettings.asaas?.companyType || '',
      incomeValue: paymentSettings.asaas?.incomeValue || 0,
      document: paymentSettings.asaas?.document || '',
      phone: paymentSettings.asaas?.phone || '',
      mobilePhone: paymentSettings.asaas?.mobilePhone || '',
      site: paymentSettings.asaas?.site || '',
      address: paymentSettings.asaas?.address || '',
      addressNumber: paymentSettings.asaas?.addressNumber || '',
      complement: paymentSettings.asaas?.complement || '',
      province: paymentSettings.asaas?.province || '',
      postalCode: paymentSettings.asaas?.postalCode || '',
      status: paymentSettings.asaas?.status || 'not_connected',
      subaccountId: paymentSettings.asaas?.subaccountId || '',
      connectedAt: paymentSettings.asaas?.connectedAt || null,
    },
    usesGlobalFee,
    effectivePlatformFeePercent,
    canEnableSplit,
    canEnableCheckout,
    warnings,
    splitPreview: {
      globalPercent: effectiveSplit.defaultPlatformFeePercent,
      tenantOverridePercent: usesGlobalFee
        ? null
        : normalizeStoredPlatformFeePercent(paymentSettings.split?.platformFeePercent),
      effectivePlatformFeePercent,
      platformPercent: effectivePlatformFeePercent,
      tenantNetPercent: Number((100 - effectivePlatformFeePercent).toFixed(2)),
      inheritsGlobal: usesGlobalFee,
      splitActive,
      mode: usesGlobalFee ? 'global' : 'custom',
    },
    summary: {
      providerLabel: PAYMENT_PROVIDER_LABELS[paymentSettings.provider] || 'Manual',
      integrationLabel: INTEGRATION_STATUS_LABELS[integrationStatus] || integrationStatus,
      tenantFinancialLabel:
        TENANT_FINANCIAL_STATUS_LABELS[tenantFinancialStatus] || tenantFinancialStatus || 'Nao conectada',
      splitLabel: splitActive ? 'Ativo' : 'Desativado',
      checkoutLabel: canEnableCheckout ? 'Ativo' : 'Bloqueado',
    },
    split: {
      enabled: splitActive,
      inheritsGlobal: usesGlobalFee,
      platformFeePercent: paymentSettings.split?.platformFeePercent || 0,
      effectivePlatformFeePercent,
      platformWalletConfigured: isValidWalletId(platformWalletId),
      defaultPlatformFeePercent: effectiveSplit.defaultPlatformFeePercent,
      mode: effectiveSplit.mode,
    },
  };
}

function assertWalletId(value, code = 'finance_wallet_invalid') {
  if (!value) {
    return;
  }

  if (!isValidWalletId(value)) {
    throw new AppError('WalletId invalida para esta operacao.', 400, code);
  }
}

function assertAsaasFinanceState(nextSettings, financeSettings) {
  const integrationStatus = resolveIntegrationStatus();
  const platformWalletId = normalizePlatformWalletId(financeSettings.platformWalletId);
  const tenantWalletId = normalizePlatformWalletId(nextSettings.asaas?.walletId);
  const provider = nextSettings.provider || PAYMENT_PROVIDERS.MANUAL;
  const usesGlobalFee = nextSettings.split?.inheritsGlobal !== false;
  const tenantFinancialStatus = resolveTenantFinancialStatus(nextSettings);
  const splitRequested = normalizeBoolean(nextSettings.split?.enabled, false) || usesGlobalFee;
  const effectivePlatformFeePercent = usesGlobalFee
    ? normalizeStoredPlatformFeePercent(financeSettings.defaultPlatformFeePercent)
    : normalizeStoredPlatformFeePercent(nextSettings.split?.platformFeePercent);

  assertWalletId(platformWalletId, 'finance_platform_wallet_invalid');
  assertWalletId(tenantWalletId, 'finance_tenant_wallet_invalid');

  if ((provider === PAYMENT_PROVIDERS.ASAAS || nextSettings.asaas?.enabled) && !isIntegrationConfigured(integrationStatus)) {
    throw new AppError('Integracao global do Asaas invalida para este tenant.', 400, 'finance_integration_invalid');
  }

  if (splitRequested && !platformWalletId) {
    throw new AppError('A wallet da plataforma e obrigatoria para aplicar split.', 400, 'finance_platform_wallet_required');
  }

  if (splitRequested && !tenantWalletId) {
    throw new AppError('A wallet do tenant e obrigatoria para aplicar split.', 400, 'finance_tenant_wallet_required');
  }

  if (
    nextSettings.enabled &&
    provider === PAYMENT_PROVIDERS.ASAAS &&
    (tenantFinancialStatus !== 'active' || !tenantWalletId)
  ) {
    throw new AppError('Checkout online indisponivel para esta subconta Asaas.', 400, 'finance_checkout_invalid');
  }

  if (nextSettings.enabled && provider === PAYMENT_PROVIDERS.ASAAS && splitRequested) {
    const canEnableSplit = Boolean(
      isIntegrationConfigured(integrationStatus) &&
        tenantFinancialStatus === 'active' &&
        isValidWalletId(platformWalletId) &&
        isValidWalletId(tenantWalletId) &&
        effectivePlatformFeePercent >= 0 &&
        effectivePlatformFeePercent <= MAX_PLATFORM_FEE_PERCENT,
    );

    if (!canEnableSplit) {
      throw new AppError('Split invalido para este tenant Asaas.', 400, 'finance_split_invalid');
    }
  }
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
  assertAsaasFinanceState(nextSettings, financeSettings);

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

  const currentSettings = resolveBusinessPaymentSettings(existingBusiness, { mode: 'storage' });

  if (hasValidAsaasSubaccountLink(currentSettings.asaas)) {
    throw new AppError(
      'Este tenant ja possui uma subconta Asaas vinculada.',
      409,
      'SUBACCOUNT_ALREADY_PROVISIONED',
      [
        {
          path: 'asaas.walletId',
          field: 'walletId',
          message: 'Remova ou revise o vinculo existente antes de criar outra subconta.',
        },
      ],
    );
  }

  const financeSettings = getStoredFinanceSettings(financeRecord?.value);
  const integrationStatus = resolveIntegrationStatus();

  if (!isIntegrationConfigured(integrationStatus)) {
    throw new AppError(
      'Integracao global do Asaas invalida para criar subconta.',
      400,
      'finance_integration_invalid',
    );
  }

  validateAsaasSubaccountPayload(payload);
  const asaasPayload = buildAsaasSubaccountPayload(payload);
  let createdSubaccount;

  try {
    createdSubaccount = await createAsaasSubaccount(asaasPayload);
  } catch (error) {
    throw sanitizeAsaasSubaccountProviderError(error);
  }

  if (!createdSubaccount?.walletId || !createdSubaccount?.apiKey) {
    throw new AppError(
      'Asaas nao retornou walletId/apiKey da subconta.',
      502,
      'SUBACCOUNT_PROVIDER_INCOMPLETE_RESPONSE',
    );
  }

  const nextSettings = {
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
      accountEmail: asaasPayload.email,
      accountName: asaasPayload.name,
      companyType: asaasPayload.companyType,
      incomeValue: asaasPayload.incomeValue,
      document: asaasPayload.cpfCnpj,
      phone: asaasPayload.phone || '',
      mobilePhone: asaasPayload.mobilePhone,
      site: asaasPayload.site || '',
      address: asaasPayload.address,
      addressNumber: asaasPayload.addressNumber,
      complement: asaasPayload.complement || '',
      province: asaasPayload.province,
      postalCode: asaasPayload.postalCode,
      status: createdSubaccount.status || 'active',
      connectedAt: new Date(),
    },
    split: {
      ...(currentSettings.split || {}),
      platformWalletId: financeSettings.platformWalletId,
      mode: 'percentage',
    },
  };
  assertAsaasFinanceState(nextSettings, financeSettings);

  const updatedBusiness = await updateBusinessRecord(businessId, {
    paymentSettings: nextSettings,
  });

  return buildTenantFinanceDto(updatedBusiness?.toObject?.() || updatedBusiness, financeRecord?.value);
}
