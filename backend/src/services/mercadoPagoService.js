import crypto from 'node:crypto';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../../../shared/constants/index.js';
import { decryptSecret } from '../utils/secretCrypto.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';

const ONLINE_PAYMENT_TYPES = ['pix', 'credit_card', 'debit_card'];
const EXTRA_EXCLUDED_PAYMENT_TYPES = [
  'account_money',
  'atm',
  'bank_transfer',
  'digital_currency',
  'prepaid_card',
  'ticket',
  'voucher',
];

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function createMercadoPagoClient(accessToken) {
  return new MercadoPagoConfig({
    accessToken,
    options: {
      timeout: 10_000,
    },
  });
}

function toMercadoPagoOrderItems(order = {}, business = {}) {
  const normalizedItems = Array.isArray(order.items) ? order.items : [];

  if (!normalizedItems.length) {
    return [
      {
        title: business.name ? `Pedido em ${business.name}` : 'Pedido TapLink',
        quantity: 1,
        unit_price: Number(Number(order.total || 0).toFixed(2)),
        currency_id: 'BRL',
      },
    ];
  }

  return normalizedItems.map((item) => ({
    title: String(item.displayQuantity || '').trim()
      ? `${item.name} (${item.displayQuantity})`
      : item.name,
    quantity: 1,
    unit_price: Number(Number(item.itemTotal || 0).toFixed(2)),
    currency_id: 'BRL',
  }));
}

function buildBackUrls(slug, orderId) {
  const baseUrl = normalizeBaseUrl(env.publicSiteBaseUrl);
  const encodedOrderId = encodeURIComponent(orderId);

  return {
    success: `${baseUrl}/site/${slug}/catalog?paymentReturn=success&orderId=${encodedOrderId}`,
    failure: `${baseUrl}/site/${slug}/catalog?paymentReturn=failure&orderId=${encodedOrderId}`,
    pending: `${baseUrl}/site/${slug}/catalog?paymentReturn=pending&orderId=${encodedOrderId}`,
  };
}

function buildNotificationUrl(businessId, orderId) {
  const query = new URLSearchParams({
    businessId: String(businessId || ''),
    orderId: String(orderId || ''),
  });

  return `${normalizeBaseUrl(env.apiPublicBaseUrl)}/api/webhooks/mercado-pago?${query.toString()}`;
}

function buildExcludedPaymentTypes(method) {
  const allowedType = method === PAYMENT_METHODS.PIX ? 'pix' : method;
  const excludedTypes = new Set(EXTRA_EXCLUDED_PAYMENT_TYPES);

  for (const candidateType of ONLINE_PAYMENT_TYPES) {
    if (candidateType !== allowedType) {
      excludedTypes.add(candidateType);
    }
  }

  return [...excludedTypes].map((id) => ({ id }));
}

function sanitizeMercadoPagoError(error) {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError(
    'Nao foi possivel iniciar o checkout online neste momento. Tente novamente em instantes.',
    502,
    'payment_provider_error',
  );
}

export function buildMercadoPagoExternalReference(businessId, orderId) {
  return `tenant:${String(businessId || '').trim()}:order:${String(orderId || '').trim()}`;
}

export function parseMercadoPagoExternalReference(value) {
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

export async function createMercadoPagoCheckoutPreference({
  business,
  order,
  paymentMethod,
  mercadoPagoSettings,
}) {
  const accessToken = decryptSecret(mercadoPagoSettings?.accessTokenEncrypted || '');

  if (!accessToken) {
    throw new AppError(
      'Este tenant ainda nao concluiu a configuracao do Mercado Pago.',
      400,
      'payment_provider_unavailable',
    );
  }

  const orderId = String(order?.id || order?._id || '').trim();
  const businessId = String(business?.id || business?._id || '').trim();
  const slug = String(business?.slug || '').trim();
  const externalReference = buildMercadoPagoExternalReference(businessId, orderId);
  const preferenceClient = new Preference(createMercadoPagoClient(accessToken));
  const body = {
    items: toMercadoPagoOrderItems(order, business),
    external_reference: externalReference,
    notification_url: buildNotificationUrl(businessId, orderId),
    back_urls: buildBackUrls(slug, orderId),
    auto_return: 'approved',
    metadata: {
      businessId,
      orderId,
      slug,
      requestedPaymentMethod: paymentMethod,
    },
    payment_methods: {
      excluded_payment_types: buildExcludedPaymentTypes(paymentMethod),
    },
    payer: {
      name: String(order?.customerName || '').trim() || undefined,
    },
  };

  try {
    const response = await preferenceClient.create({
      body,
      requestOptions: {
        idempotencyKey: crypto.randomUUID(),
      },
    });
    const checkoutUrl = String(response.init_point || response.sandbox_init_point || '').trim();
    const preferenceId = String(response.id || '').trim();

    if (!checkoutUrl || !preferenceId) {
      throw new Error('Mercado Pago preference response missing id/init_point.');
    }

    return {
      preferenceId,
      checkoutUrl,
      externalReference,
    };
  } catch (error) {
    throw sanitizeMercadoPagoError(error);
  }
}

function mapMercadoPagoStatus(status) {
  switch (String(status || '').trim().toLowerCase()) {
    case 'approved':
      return PAYMENT_STATUS.PAID;
    case 'rejected':
      return PAYMENT_STATUS.FAILED;
    case 'cancelled':
    case 'canceled':
      return PAYMENT_STATUS.CANCELLED;
    case 'pending':
    case 'in_process':
    default:
      return PAYMENT_STATUS.PENDING;
  }
}

export async function getMercadoPagoPayment({
  providerPaymentId,
  mercadoPagoSettings,
}) {
  const accessToken = decryptSecret(mercadoPagoSettings?.accessTokenEncrypted || '');

  if (!accessToken) {
    throw new AppError(
      'Este tenant ainda nao concluiu a configuracao do Mercado Pago.',
      400,
      'payment_provider_unavailable',
    );
  }

  try {
    const paymentClient = new Payment(createMercadoPagoClient(accessToken));
    const payment = await paymentClient.get({ id: providerPaymentId });

    return {
      providerPaymentId: String(payment.id || providerPaymentId || ''),
      providerPreferenceId: String(payment.order?.id || ''),
      externalReference: String(payment.external_reference || ''),
      method:
        String(payment.payment_type_id || '').trim().toLowerCase() === 'debit_card'
          ? PAYMENT_METHODS.DEBIT_CARD
          : String(payment.payment_type_id || '').trim().toLowerCase() === 'credit_card'
            ? PAYMENT_METHODS.CREDIT_CARD
            : PAYMENT_METHODS.PIX,
      status: mapMercadoPagoStatus(payment.status),
      rawStatus: String(payment.status || ''),
      rawStatusDetail: String(payment.status_detail || ''),
      amount: Number(Number(payment.transaction_amount || 0).toFixed(2)),
      paidAt: payment.date_approved ? new Date(payment.date_approved) : null,
    };
  } catch (error) {
    throw sanitizeMercadoPagoError(error);
  }
}
