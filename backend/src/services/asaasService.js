import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { PAYMENT_STATUS } from '../../../shared/constants/index.js';
import { decryptSecret } from '../utils/secretCrypto.js';

function getAsaasEnvironment() {
  return String(env.asaasEnv || process.env.ASAAS_ENV || 'sandbox')
    .trim()
    .toLowerCase();
}

function getAsaasBaseUrl() {
  return getAsaasEnvironment() === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';
}

function sanitizeAsaasErrorMessage(payload) {
  if (payload?.errors?.length) {
    return String(payload.errors[0]?.description || '').trim();
  }

  return '';
}

async function parseAsaasResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (response.ok) {
    return payload;
  }

  throw new AppError(
    sanitizeAsaasErrorMessage(payload) ||
      'Nao foi possivel concluir a operacao com o Asaas no momento.',
    response.status >= 400 && response.status < 500 ? 400 : 502,
    response.status === 401 ? 'payment_provider_unauthorized' : 'payment_provider_error',
  );
}

async function asaasRequest({ apiKey, method, path, body }) {
  const normalizedApiKey = resolveAsaasApiKey(apiKey);

  if (!normalizedApiKey) {
    throw new AppError(
      'Este tenant ainda nao concluiu a configuracao do Asaas.',
      400,
      'payment_provider_unavailable',
    );
  }

  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    method,
    headers: {
      access_token: normalizedApiKey,
      'content-type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  return parseAsaasResponse(response);
}

function resolveAsaasApiKey(apiKey) {
  const normalizedApiKey = String(apiKey || '').trim();

  if (!normalizedApiKey) {
    return '';
  }

  if (normalizedApiKey.startsWith('v1:')) {
    return decryptSecret(normalizedApiKey);
  }

  return normalizedApiKey;
}

export function buildAsaasExternalReference(businessId, orderId) {
  return `tenant:${String(businessId || '').trim()}:order:${String(orderId || '').trim()}`;
}

export function parseAsaasExternalReference(value) {
  const normalizedValue = String(value || '').trim();
  const match = /^tenant:([^:]+):order:([^:]+)$/i.exec(normalizedValue);

  if (!match) {
    return null;
  }

  return {
    businessId: match[1],
    orderId: match[2],
  };
}

export function validatePlatformFeePercent(value) {
  const percent = Number(value);

  if (!Number.isFinite(percent) || percent < 0 || percent > 30) {
    throw new AppError('Percentual da plataforma invalido.', 400, 'platform_fee_invalid');
  }

  return Number(percent.toFixed(2));
}

export function buildAsaasSplitRules({ total, platformFeePercent, platformWalletId }) {
  const normalizedTotal = Number(Number(total || 0).toFixed(2));
  const percent = validatePlatformFeePercent(platformFeePercent);
  const normalizedWalletId = String(platformWalletId || '').trim();

  if (!percent || !normalizedWalletId) {
    return {
      platformFeeAmount: 0,
      tenantNetAmount: normalizedTotal,
      split: [],
    };
  }

  const platformFeeAmount = Number(((normalizedTotal * percent) / 100).toFixed(2));
  const tenantNetAmount = Number((normalizedTotal - platformFeeAmount).toFixed(2));

  return {
    platformFeeAmount,
    tenantNetAmount,
    split: [
      {
        walletId: normalizedWalletId,
        percentualValue: percent,
      },
    ],
  };
}

export function mapAsaasPaymentStatus(status) {
  switch (String(status || '').trim().toUpperCase()) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return PAYMENT_STATUS.PAID;
    case 'OVERDUE':
    case 'REFUNDED':
    case 'CHARGEBACK':
    case 'FAILED':
      return PAYMENT_STATUS.FAILED;
    case 'CANCELLED':
      return PAYMENT_STATUS.CANCELLED;
    case 'PENDING':
    default:
      return PAYMENT_STATUS.PENDING;
  }
}

export async function createAsaasSubaccount(payload, { rootApiKey } = {}) {
  const apiKey = rootApiKey || env.asaasApiKey || process.env.ASAAS_API_KEY || '';
  const response = await asaasRequest({
    apiKey,
    method: 'POST',
    path: '/accounts',
    body: payload,
  });

  return {
    id: String(response.id || '').trim(),
    walletId: String(response.walletId || '').trim(),
    apiKey: String(response.apiKey || '').trim(),
  };
}

export async function createAsaasPaymentCharge({ apiKey, charge }) {
  return asaasRequest({
    apiKey,
    method: 'POST',
    path: '/payments',
    body: charge,
  });
}

export async function createAsaasCustomer({ apiKey, customer }) {
  return asaasRequest({
    apiKey,
    method: 'POST',
    path: '/customers',
    body: customer,
  });
}

export async function getAsaasPayment({ apiKey, paymentId }) {
  return asaasRequest({
    apiKey,
    method: 'GET',
    path: `/payments/${encodeURIComponent(String(paymentId || '').trim())}`,
  });
}

export async function getAsaasPixQrCode({ apiKey, paymentId }) {
  const response = await asaasRequest({
    apiKey,
    method: 'GET',
    path: `/payments/${encodeURIComponent(String(paymentId || '').trim())}/pixQrCode`,
  });

  return {
    payload: String(response.payload || '').trim(),
    encodedImage: String(response.encodedImage || '').trim(),
  };
}
