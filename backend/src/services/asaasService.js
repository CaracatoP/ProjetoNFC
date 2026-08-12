import { AppError } from '../utils/appError.js';
import { PAYMENT_STATUS } from '../../../shared/constants/index.js';
import { env } from '../config/env.js';
import { createAsaasClient } from '../integrations/asaas/asaas.client.js';
import { getAsaasRuntimeConfig } from '../integrations/asaas/asaas.config.js';
import { AsaasNotConfiguredError } from '../integrations/asaas/asaas.errors.js';

async function asaasRequest({ apiKey, method, path, body, operation }) {
  try {
    return await createAsaasClient({ apiKey }).request({
      method,
      path,
      body,
      operation,
    });
  } catch (error) {
    if (error instanceof AsaasNotConfiguredError) {
      throw new AppError(
        'Este tenant ainda nao concluiu a configuracao do Asaas.',
        400,
        'payment_provider_unavailable',
      );
    }

    throw error;
  }
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
    operation: 'create_subaccount',
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
    operation: 'create_payment',
  });
}

export async function createAsaasCustomer({ apiKey, customer }) {
  return asaasRequest({
    apiKey,
    method: 'POST',
    path: '/customers',
    body: customer,
    operation: 'create_customer',
  });
}

export async function getAsaasPayment({ apiKey, paymentId }) {
  return asaasRequest({
    apiKey,
    method: 'GET',
    path: `/payments/${encodeURIComponent(String(paymentId || '').trim())}`,
    operation: 'get_payment',
  });
}

export async function getAsaasPixQrCode({ apiKey, paymentId }) {
  const response = await asaasRequest({
    apiKey,
    method: 'GET',
    path: `/payments/${encodeURIComponent(String(paymentId || '').trim())}/pixQrCode`,
    operation: 'get_pix_qr_code',
  });

  return {
    payload: String(response.payload || '').trim(),
    encodedImage: String(response.encodedImage || '').trim(),
  };
}

export async function testAsaasConnection({ apiKey } = {}) {
  const runtimeConfig = getAsaasRuntimeConfig({
    apiKey: apiKey || env.asaasApiKey || process.env.ASAAS_API_KEY || '',
  });

  if (!runtimeConfig.configured) {
    return {
      ok: false,
      environment: runtimeConfig.environment,
      status: 'not_configured',
      message: 'Asaas nao configurado.',
    };
  }

  await asaasRequest({
    apiKey: runtimeConfig.apiKey,
    method: 'GET',
    path: '/myAccount/status/',
    operation: 'test_connection',
  });

  return {
    ok: true,
    environment: runtimeConfig.environment,
    status: 'connected',
    message: `Asaas conectado com sucesso - ${runtimeConfig.environment}.`,
  };
}
