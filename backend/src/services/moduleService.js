import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { findBusinessById, findBusinessBySlugStrict } from '../repositories/businessRepository.js';
import {
  createAppointmentRequestRecord,
  findAppointmentRequestById,
  listAppointmentRequestsByBusinessId,
  updateAppointmentRequestRecord,
  updateAppointmentRequestRecordByBusinessId,
} from '../repositories/appointmentRequestRepository.js';
import {
  createAppointmentServiceRecord,
  deleteAppointmentServiceRecordByBusinessId,
  findAppointmentServiceById,
  listAppointmentServicesByBusinessId,
  updateAppointmentServiceRecordByBusinessId,
} from '../repositories/appointmentServiceRepository.js';
import {
  createOrderRecord,
  findOrderById,
  findOrderByBusinessIdAndCheckoutTokenHash,
  listOrdersByBusinessId,
  archiveOrderRecordByBusinessId,
  updateOrderRecordByBusinessId,
} from '../repositories/orderRepository.js';
import {
  createProductRecord,
  deleteProductRecordByBusinessId,
  findProductById,
  listProductsByBusinessIdAndIds,
  listProductsByBusinessId,
  updateProductRecordByBusinessId,
} from '../repositories/productRepository.js';
import {
  createProfessionalRecord,
  deleteProfessionalRecordByBusinessId,
  findProfessionalById,
  listProfessionalsByBusinessId,
  updateProfessionalRecordByBusinessId,
} from '../repositories/professionalRepository.js';
import {
  BUSINESS_STATUS,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUS,
} from '../../../shared/constants/index.js';
import {
  isBusinessPaymentMethodEnabled,
  normalizeLegacyPaymentMethodAlias,
  normalizeOrderPayment,
  normalizeOrderPaymentEvent,
  normalizeOrderPaymentEvents,
  normalizePaymentStatus,
  resolveBusinessPaymentSettings,
} from '../../../shared/utils/businessPayment.js';
import {
  buildLegacyDisplayQuantity,
  calculateMeasuredItemTotal,
  isValidMeasurementQuantity,
  normalizeMeasurementUnit,
  normalizeProductMeasurement,
} from '../../../shared/utils/productMeasurement.js';
import { roundMoneyValue, sumMoneyValues } from '../../../shared/utils/money.js';
import {
  normalizeCustomerDocument,
  validateCustomerDocument,
} from '../../../shared/utils/customerDocument.js';
import {
  normalizeProductAvailability,
  normalizeProductInventory,
} from '../../../shared/utils/productInventory.js';
import { TENANT_REALTIME_KINDS } from '../../../shared/constants/tenantRealtime.js';
import { buildPixPayload } from '../../../shared/utils/pix.js';
import { publishTenantUpdated } from './tenantRealtimeService.js';
import { createMercadoPagoCheckoutPreference } from './mercadoPagoService.js';
import { upsertPaymentByProviderPaymentId } from '../repositories/paymentRepository.js';
import {
  getDeclaredHostedCheckoutProvider,
  isMercadoPagoProviderConnected,
} from '../utils/paymentProvider.js';
import { validatePaymentMethodForDeliveryType } from '../utils/paymentDeliveryValidation.js';
import { createPublicCheckoutToken, hashPublicCheckoutToken } from '../utils/publicCheckoutToken.js';
import {
  buildAsaasExternalReference,
  buildAsaasSplitRules,
  createAsaasPaymentCharge,
  getAsaasPayment,
  getAsaasPixQrCode,
  mapAsaasPaymentStatus,
  normalizeAsaasPixQrCodeImage,
} from './asaasService.js';
import { resolveEffectiveAsaasSplitSettings } from './adminFinanceService.js';
import { resolveOrCreateAsaasPaymentCustomer } from './paymentCustomerService.js';
import {
  calculatePlatformFeeBreakdown,
  getPlatformFinanceSettings,
  resolveAsaasProviderContext,
  resolveEffectivePlatformFeePercent,
  usesCentralizedPaymentArchitecture,
} from './platformFinanceService.js';
import { syncTenantLedgerForPayment } from './tenantFinanceService.js';

function toPlainRecord(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toJSON === 'function') {
    return value.toJSON();
  }

  return {
    ...value,
    id: value.id || value._id?.toString(),
  };
}

async function assertBusinessExists(businessId) {
  const business = await findBusinessById(businessId);

  if (!business) {
    throw new AppError('Negócio não encontrado', 404, 'business_not_found');
  }

  return business;
}

async function assertPublicBusinessBySlug(slug) {
  const business = await findBusinessBySlugStrict(slug);

  if (!business) {
    throw new AppError('Negócio não encontrado', 404, 'business_not_found');
  }

  if (![BUSINESS_STATUS.ACTIVE, BUSINESS_STATUS.DRAFT].includes(business.status)) {
    throw new AppError('Este site está temporariamente indisponível.', 423, 'business_inactive');
  }

  return business;
}

function publishBusinessModuleEvent(business, kind, operation = 'updated') {
  if (!business) {
    return;
  }

  publishTenantUpdated({
    operation,
    kind,
    businessId: String(business.id || business._id || ''),
    slug: business.slug || '',
    status: business.status || '',
    domains: business.domains || {},
  });
}

function assertTenantScope(entity, businessId, resourceLabel) {
  if (!entity) {
    throw new AppError(`${resourceLabel} não encontrado`, 404, 'module_resource_not_found');
  }

  if (String(entity.businessId) !== String(businessId)) {
    throw new AppError('Este recurso pertence a outro tenant', 404, 'module_resource_not_found');
  }
}

function serializeProductRecord(item) {
  const record = normalizeProductMeasurement(toPlainRecord(item));
  const isAvailable = normalizeProductAvailability(record.isAvailable);
  const inventory = normalizeProductInventory(record.inventory, record.measurementUnit);

  return {
    ...record,
    price: Number(record.price || 0),
    image: record.image || '',
    imagePublicId: record.imagePublicId || '',
    category: record.category || '',
    isAvailable,
    inventory,
    active: record.active !== false,
    options: Array.isArray(record.options) ? record.options : [],
  };
}

function normalizeProductMutationPayload(payload = {}, fallbackMeasurementUnit) {
  const measurementUnit = normalizeMeasurementUnit(
    payload.measurementUnit || fallbackMeasurementUnit,
  );

  return {
    ...payload,
    measurementUnit,
    isAvailable: normalizeProductAvailability(payload.isAvailable),
    inventory: normalizeProductInventory(payload.inventory, measurementUnit),
  };
}

function serializeOrderItem(item = {}) {
  const measurementUnit = normalizeMeasurementUnit(item.measurementUnit);
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);

  return {
    productId: item.productId ? String(item.productId) : '',
    name: item.name || '',
    quantity,
    unitPrice,
    measurementUnit,
    displayQuantity:
      String(item.displayQuantity || '').trim() || buildLegacyDisplayQuantity(quantity, measurementUnit),
    itemTotal: Number.isFinite(Number(item.itemTotal))
      ? roundMoneyValue(item.itemTotal)
      : calculateMeasuredItemTotal(unitPrice, quantity),
    notes: item.notes || '',
  };
}

function serializeOrderRecord(item) {
  const record = toPlainRecord(item);
  const {
    publicCheckoutTokenHash: _publicCheckoutTokenHash,
    publicCheckoutTokenIssuedAt: _publicCheckoutTokenIssuedAt,
    ...safeRecord
  } = record || {};
  const items = Array.isArray(safeRecord.items) ? safeRecord.items.map(serializeOrderItem) : [];
  const total = Number(safeRecord.total || 0)
    ? roundMoneyValue(safeRecord.total || 0)
    : sumMoneyValues(items.map((orderItem) => orderItem.itemTotal || 0));

  return {
    ...safeRecord,
    customerName: safeRecord.customerName || '',
    customerPhone: safeRecord.customerPhone || '',
    items,
    total,
    deliveryType: safeRecord.deliveryType || 'pickup',
    address: safeRecord.address || '',
    status: safeRecord.status || 'received',
    createdAt: safeRecord.createdAt || null,
    updatedAt: safeRecord.updatedAt || null,
    receivedAt: safeRecord.receivedAt || safeRecord.createdAt || null,
    preparingAt: safeRecord.preparingAt || null,
    readyAt: safeRecord.readyAt || null,
    deliveredAt: safeRecord.deliveredAt || null,
    cancelledAt: safeRecord.cancelledAt || null,
    notes: safeRecord.notes || '',
    payment: normalizeOrderPayment(safeRecord.payment || {}, total),
  };
}

function isRecoverablePublicOrderPayment(payment = {}) {
  return normalizeOrderPayment(payment).method === PAYMENT_METHODS.PIX;
}

function buildPublicOrderCheckoutResponse(order, checkoutToken = '') {
  const serializedOrder = serializeOrderRecord(order);

  return checkoutToken
    ? {
        ...serializedOrder,
        checkoutToken,
      }
    : serializedOrder;
}

async function serializePublicOrderPaymentRecovery(order, business = null) {
  const serializedOrder = serializeOrderRecord(order);
  let recoveredPayment = serializedOrder.payment;

  if (
    business &&
    recoveredPayment?.provider === PAYMENT_PROVIDERS.ASAAS &&
    recoveredPayment?.providerPaymentId
  ) {
    try {
      const storedPaymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
      const financeSettings = await getPlatformFinanceSettings();
      const asaasContext = resolveAsaasProviderContext({
        business,
        paymentSettings: storedPaymentSettings,
        financeSettings,
      });
      const providerPaymentId = String(recoveredPayment.providerPaymentId || '').trim();
      const providerPayment = await getAsaasPayment({
        apiKey: asaasContext.apiKey,
        paymentId: providerPaymentId,
      });
      const paymentPatch = buildAsaasWebhookPaymentPatch(
        {
          ...serializedOrder,
          payment: recoveredPayment,
        },
        providerPayment,
        'PUBLIC_PAYMENT_RECOVERY',
        new Date(),
      );

      recoveredPayment = paymentPatch.payment;

      if (
        recoveredPayment?.method === PAYMENT_METHODS.PIX &&
        recoveredPayment?.status === PAYMENT_STATUS.PENDING &&
        providerPaymentId &&
        (!recoveredPayment?.pixCopyPaste || !recoveredPayment?.pixQrCode)
      ) {
        try {
          const pixQrCode = await getAsaasPixQrCode({
            apiKey: asaasContext.apiKey,
            paymentId: providerPaymentId,
          });

          logger.info(
            {
              businessId: String(business?._id || ''),
              orderId: String(serializedOrder.id || ''),
              providerPaymentId,
              paymentProvider: PAYMENT_PROVIDERS.ASAAS,
              hasEncodedImage: Boolean(pixQrCode.encodedImage),
              hasPayload: Boolean(pixQrCode.payload),
              encodedImageLength: pixQrCode.encodedImage ? pixQrCode.encodedImage.length : 0,
            },
            'Rehydrated Asaas Pix QR code during public payment recovery',
          );

          recoveredPayment = normalizeOrderPayment(
            {
              ...recoveredPayment,
              pixCopyPaste: recoveredPayment.pixCopyPaste || pixQrCode.payload,
              pixQrCode: recoveredPayment.pixQrCode || normalizeAsaasPixQrCodeImage(pixQrCode.encodedImage),
            },
            serializedOrder.total || recoveredPayment.amount || 0,
          );
        } catch (error) {
          logger.warn(
            {
              businessId: String(business?._id || ''),
              orderId: String(serializedOrder.id || ''),
              providerPaymentId,
              paymentProvider: PAYMENT_PROVIDERS.ASAAS,
              code: error?.code,
              statusCode: error?.statusCode,
            },
            'Failed to rehydrate Asaas Pix QR code during public payment recovery',
          );
        }
      }
    } catch (error) {
      logger.warn(
        {
          businessId: String(business?._id || ''),
          orderId: String(serializedOrder.id || ''),
          providerPaymentId: String(recoveredPayment?.providerPaymentId || '').trim(),
          paymentProvider: PAYMENT_PROVIDERS.ASAAS,
          code: error?.code,
          statusCode: error?.statusCode,
        },
        'Failed to refresh Asaas payment while recovering a public order',
      );
    }
  }

  return {
    id: serializedOrder.id || '',
    total: serializedOrder.total || 0,
    status: serializedOrder.status || 'received',
    createdAt: serializedOrder.createdAt || null,
    updatedAt: serializedOrder.updatedAt || null,
    payment: recoveredPayment,
  };
}

const ORDER_STATUS_TIMESTAMP_FIELDS = {
  received: 'receivedAt',
  preparing: 'preparingAt',
  ready: 'readyAt',
  delivered: 'deliveredAt',
  cancelled: 'cancelledAt',
};

function buildOrderStatusTimestampPatch(existingOrder, status, occurredAt = new Date()) {
  const timestampField = ORDER_STATUS_TIMESTAMP_FIELDS[status];

  if (!timestampField) {
    return { status };
  }

  return {
    status,
    ...(existingOrder?.[timestampField] ? {} : { [timestampField]: occurredAt }),
  };
}

function resolveRequestedPaymentMethod(payload, paymentSettings) {
  const requestedMethod = normalizeLegacyPaymentMethodAlias(
    payload?.payment?.method,
    payload?.deliveryType,
    paymentSettings?.methods,
  );
  const { paymentMethod } = validatePaymentMethodForDeliveryType(
    payload?.deliveryType,
    requestedMethod,
  );

  if (!isBusinessPaymentMethodEnabled(paymentSettings, paymentMethod)) {
    throw new AppError(
      'Esta forma de pagamento não está disponível para este tenant.',
      400,
      'payment_method_unavailable',
    );
  }

  return paymentMethod;
}

function resolveRequestedPaymentProvider(payload, method, paymentSettings) {
  const requestedProvider = String(payload?.payment?.provider || '').trim().toLowerCase();
  const declaredHostedProvider = getDeclaredHostedCheckoutProvider(paymentSettings);
  const configuredProvider = paymentSettings?.provider || PAYMENT_PROVIDERS.MANUAL;

  if ([PAYMENT_METHODS.CASH_ON_PICKUP, PAYMENT_METHODS.CASH_ON_DELIVERY].includes(method)) {
    return PAYMENT_PROVIDERS.MANUAL;
  }

  if ([PAYMENT_METHODS.CREDIT_CARD, PAYMENT_METHODS.DEBIT_CARD].includes(method)) {
    if (
      requestedProvider &&
      [PAYMENT_PROVIDERS.ASAAS, PAYMENT_PROVIDERS.MERCADO_PAGO].includes(requestedProvider)
    ) {
      return requestedProvider;
    }

    return declaredHostedProvider || PAYMENT_PROVIDERS.MANUAL;
  }

  if (method !== PAYMENT_METHODS.PIX) {
    return PAYMENT_PROVIDERS.MANUAL;
  }

  const manualPixAvailable = Boolean(
    configuredProvider === PAYMENT_PROVIDERS.MANUAL &&
      paymentSettings?.methods?.pix &&
      paymentSettings?.pix?.key,
  );
  const hostedPixAvailable = Boolean(paymentSettings?.methods?.pix && declaredHostedProvider);

  if (hostedPixAvailable) {
    return declaredHostedProvider;
  }

  if (requestedProvider === PAYMENT_PROVIDERS.MANUAL && manualPixAvailable) {
    return PAYMENT_PROVIDERS.MANUAL;
  }

  if (manualPixAvailable) {
    return PAYMENT_PROVIDERS.MANUAL;
  }

  if (hostedPixAvailable) {
    return declaredHostedProvider;
  }

  return PAYMENT_PROVIDERS.MANUAL;
}

function assertMercadoPagoPaymentMethodAllowed(paymentSettings, method) {
  if (!getDeclaredHostedCheckoutProvider(paymentSettings)) {
    throw new AppError(
      'Pagamento online indisponível para este tenant no momento.',
      400,
      'payment_provider_unavailable',
    );
  }

  if (
    (method === PAYMENT_METHODS.PIX && !paymentSettings?.methods?.pix) ||
    (method === PAYMENT_METHODS.CREDIT_CARD && !paymentSettings?.methods?.creditCard) ||
    (method === PAYMENT_METHODS.DEBIT_CARD && !paymentSettings?.methods?.debitCard)
  ) {
    throw new AppError(
      'Esta forma de pagamento não está disponível para este tenant.',
      400,
      'payment_method_unavailable',
    );
  }

  if (!isMercadoPagoProviderConnected(paymentSettings)) {
    throw new AppError(
      'Este tenant ainda não concluiu a configuração do Mercado Pago.',
      400,
      'payment_provider_unavailable',
    );
  }
}

function assertAsaasPaymentMethodAllowed({
  business,
  paymentSettings,
  financeSettings,
  method,
}) {
  if (!getDeclaredHostedCheckoutProvider(paymentSettings)) {
    throw new AppError(
      'Pagamento online indisponível para este tenant no momento.',
      400,
      'payment_provider_unavailable',
    );
  }

  if (
    (method === PAYMENT_METHODS.PIX && !paymentSettings?.methods?.pix) ||
    (method === PAYMENT_METHODS.CREDIT_CARD && !paymentSettings?.methods?.creditCard) ||
    (method === PAYMENT_METHODS.DEBIT_CARD && !paymentSettings?.methods?.debitCard)
  ) {
    throw new AppError(
      'Esta forma de pagamento não está disponível para este tenant.',
      400,
      'payment_method_unavailable',
    );
  }

  const asaasContext = resolveAsaasProviderContext({
    business,
    paymentSettings,
    financeSettings,
  });

  if (!asaasContext.connected) {
    throw new AppError(
      'Este tenant ainda não concluiu a configuração do Asaas.',
      400,
      'payment_provider_unavailable',
    );
  }
}

function buildManualPixPaymentSnapshot(paymentSettings, amount) {
  const pixPayload = buildPixPayload(
    {
      keyType: 'random',
      key: paymentSettings.pix.key,
      receiverName: paymentSettings.pix.merchantName,
      city: paymentSettings.pix.merchantCity,
    },
    amount,
  );

  if (!pixPayload) {
    throw new AppError(
      'O tenant ainda não configurou uma chave Pix válida para este checkout.',
      400,
      'payment_method_unavailable',
    );
  }

  return normalizeOrderPayment(
    {
      method: PAYMENT_METHODS.PIX,
      status: PAYMENT_STATUS.PENDING,
      provider: PAYMENT_PROVIDERS.MANUAL,
      amount,
      pixCopyPaste: pixPayload,
      pixQrCodeUrl: '',
      providerPaymentId: '',
      paidAt: null,
    },
    amount,
  );
}

function buildManualCashPaymentSnapshot(method, amount) {
  return normalizeOrderPayment(
    {
      method,
      status: PAYMENT_STATUS.MANUAL,
      provider: PAYMENT_PROVIDERS.MANUAL,
      amount,
      pixCopyPaste: '',
      pixQrCodeUrl: '',
      providerPaymentId: '',
      paidAt: null,
    },
    amount,
  );
}

function buildMercadoPagoPaymentSnapshot(method, amount, occurredAt = new Date()) {
  return normalizeOrderPayment(
    {
      method,
      status: PAYMENT_STATUS.PENDING,
      provider: PAYMENT_PROVIDERS.MERCADO_PAGO,
      amount,
      pixCopyPaste: '',
      pixQrCodeUrl: '',
      providerPaymentId: '',
      providerPreferenceId: '',
      checkoutUrl: '',
      paidAt: null,
      updatedAt: occurredAt,
    },
    amount,
  );
}

function buildAsaasPaymentSnapshot(
  method,
  amount,
  { paymentArchitecture = 'centralized', occurredAt = new Date() } = {},
) {
  return normalizeOrderPayment(
    {
      method,
      status: PAYMENT_STATUS.PENDING,
      provider: PAYMENT_PROVIDERS.ASAAS,
      paymentArchitecture,
      amount,
      grossAmount: amount,
      refundedAmount: 0,
      pixCopyPaste: '',
      pixQrCodeUrl: '',
      pixQrCode: '',
      providerPaymentId: '',
      providerCustomerId: '',
      invoiceUrl: '',
      bankSlipUrl: '',
      paidAt: null,
      confirmedAt: null,
      receivedAt: null,
      providerUpdatedAt: occurredAt,
      updatedAt: occurredAt,
    },
    amount,
  );
}

function enrichAsaasPaymentFinancials(
  payment,
  totalAmount,
  { businessPaymentSettings = {}, financeSettings = {} } = {},
) {
  const normalizedPayment = normalizeOrderPayment(payment || {}, totalAmount);
  const effectiveFeePercent = resolveEffectivePlatformFeePercent(
    businessPaymentSettings,
    financeSettings,
  );
  const breakdown = calculatePlatformFeeBreakdown(
    normalizedPayment.grossAmount || normalizedPayment.amount || totalAmount,
    effectiveFeePercent,
  );

  return normalizeOrderPayment(
    {
      ...normalizedPayment,
      paymentArchitecture:
        normalizedPayment.paymentArchitecture || financeSettings?.paymentArchitecture || 'centralized',
      grossAmount: breakdown.grossAmount,
      platformFeeAmount: breakdown.platformFeeAmount,
      tenantNetAmount: breakdown.tenantNetAmount,
    },
    totalAmount,
  );
}

function resolveAsaasBillingType(method) {
  if (method === PAYMENT_METHODS.PIX) {
    return 'PIX';
  }

  return 'UNDEFINED';
}

function buildAsaasPaymentReferencePayload({
  businessId,
  orderId,
  payment,
  providerPayment = {},
  providerStatus = '',
  billingType = '',
  externalReference = '',
  occurredAt = new Date(),
}) {
  const normalizedPayment = normalizeOrderPayment(payment || {}, payment?.amount || 0);

  return {
    businessId,
    orderId,
    provider: PAYMENT_PROVIDERS.ASAAS,
    method: normalizedPayment.method,
    billingType,
    status: normalizedPayment.status,
    providerStatus: String(providerStatus || providerPayment?.status || '').trim(),
    providerPaymentId: String(providerPayment?.id || normalizedPayment.providerPaymentId || '').trim(),
    providerCustomerId: String(providerPayment?.customer || normalizedPayment.providerCustomerId || '').trim(),
    externalReference: String(externalReference || providerPayment?.externalReference || '').trim(),
    amount: normalizedPayment.amount,
    grossAmount: normalizedPayment.grossAmount || normalizedPayment.amount,
    platformFeeAmount: normalizedPayment.platformFeeAmount,
    tenantNetAmount: normalizedPayment.tenantNetAmount,
    paymentArchitecture: normalizedPayment.paymentArchitecture,
    refundedAmount: normalizedPayment.refundedAmount || 0,
    invoiceUrl: normalizedPayment.invoiceUrl,
    bankSlipUrl: normalizedPayment.bankSlipUrl,
    checkoutUrl: normalizedPayment.checkoutUrl,
    pixCopyPaste: normalizedPayment.pixCopyPaste,
    pixQrCode: normalizedPayment.pixQrCode,
    pixQrCodeUrl: normalizedPayment.pixQrCodeUrl,
    paidAt: normalizedPayment.paidAt,
    confirmedAt: normalizedPayment.confirmedAt,
    receivedAt: normalizedPayment.receivedAt,
    providerUpdatedAt: occurredAt,
  };
}

function requiresAsaasCustomerDocument(payment = {}) {
  return (
    payment?.provider === PAYMENT_PROVIDERS.ASAAS &&
    payment?.method === PAYMENT_METHODS.PIX
  );
}

function resolveCheckoutCustomerDocument(payload = {}) {
  return normalizeCustomerDocument(
    payload.customerDocument || payload.document || payload.cpfCnpj || payload.customer?.document,
  );
}

function assertValidCheckoutCustomerDocument(payload = {}) {
  const validation = validateCustomerDocument(resolveCheckoutCustomerDocument(payload), {
    required: true,
  });

  if (validation.isValid) {
    return validation.normalizedValue;
  }

  throw new AppError(
    validation.message,
    400,
    validation.errorCode === 'document_required'
      ? 'order_customer_document_required'
      : 'order_customer_document_invalid',
    [
      {
        field: 'customerDocument',
        message: validation.message,
        type: validation.type || 'document',
      },
    ],
  );
}

async function buildPublicOrderPaymentSnapshot(
  business,
  payload,
  amount,
  occurredAt = new Date(),
) {
  const paymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
  const method = resolveRequestedPaymentMethod(payload, paymentSettings);
  const provider = resolveRequestedPaymentProvider(payload, method, paymentSettings);

  if (provider === PAYMENT_PROVIDERS.MERCADO_PAGO) {
    assertMercadoPagoPaymentMethodAllowed(paymentSettings, method);
    return buildMercadoPagoPaymentSnapshot(method, amount, occurredAt);
  }

  if (provider === PAYMENT_PROVIDERS.ASAAS) {
    const financeSettings = await getPlatformFinanceSettings();
    const asaasContext = resolveAsaasProviderContext({
      business,
      paymentSettings,
      financeSettings,
    });

    assertAsaasPaymentMethodAllowed({
      business,
      paymentSettings,
      financeSettings,
      method,
    });

    return buildAsaasPaymentSnapshot(method, amount, {
      paymentArchitecture: asaasContext.paymentArchitecture,
      occurredAt,
    });
  }

  if (method === PAYMENT_METHODS.PIX) {
    return buildManualPixPaymentSnapshot(paymentSettings, amount);
  }

  return buildManualCashPaymentSnapshot(method, amount);
}

function buildOrderPaymentStatusPatch(existingOrder, status, occurredAt = new Date()) {
  const currentPayment = normalizeOrderPayment(existingOrder?.payment || {}, existingOrder?.total || 0);
  const nextStatus = normalizePaymentStatus(status, currentPayment.status);
  const paymentEvents = normalizeOrderPaymentEvents(existingOrder?.paymentEvents || []);
  const nextPayment = {
    ...currentPayment,
    status: nextStatus,
    amount: Number(Number(existingOrder?.total || currentPayment.amount || 0).toFixed(2)),
    paidAt:
      nextStatus === PAYMENT_STATUS.PAID
        ? currentPayment.paidAt || occurredAt
        : currentPayment.paidAt || null,
  };

  if (
    currentPayment.provider === PAYMENT_PROVIDERS.MANUAL &&
    currentPayment.status !== PAYMENT_STATUS.PAID &&
    nextStatus === PAYMENT_STATUS.PAID
  ) {
    return {
      payment: nextPayment,
      paymentEvents: appendUniquePaymentEvents(paymentEvents, [
        {
          type: 'manual_mark_paid',
          provider: PAYMENT_PROVIDERS.MANUAL,
          status: PAYMENT_STATUS.PAID,
          providerPaymentId: currentPayment.providerPaymentId || '',
          occurredAt,
          meta: {
            method: currentPayment.method,
          },
        },
      ]),
    };
  }

  return {
    payment: nextPayment,
  };
}

function buildMercadoPagoWebhookPaymentPatch(existingOrder, paymentSnapshot, occurredAt = new Date()) {
  const currentPayment = normalizeOrderPayment(existingOrder?.payment || {}, existingOrder?.total || 0);
  const nextStatus = normalizePaymentStatus(paymentSnapshot?.status, currentPayment.status);
  const nextPaidAt =
    nextStatus === PAYMENT_STATUS.PAID
      ? currentPayment.paidAt || paymentSnapshot?.paidAt || occurredAt
      : currentPayment.paidAt || null;
  const nextPayment = normalizeOrderPayment(
    {
      ...currentPayment,
      method: paymentSnapshot?.method || currentPayment.method,
      provider: PAYMENT_PROVIDERS.MERCADO_PAGO,
      status: nextStatus,
      amount: Number(Number(existingOrder?.total || currentPayment.amount || 0).toFixed(2)),
      providerPaymentId: paymentSnapshot?.providerPaymentId || currentPayment.providerPaymentId,
      providerPreferenceId:
        paymentSnapshot?.providerPreferenceId || currentPayment.providerPreferenceId,
      paidAt: nextPaidAt,
      updatedAt: occurredAt,
    },
    existingOrder?.total || currentPayment.amount || 0,
  );
  const hasChanged =
    nextPayment.method !== currentPayment.method ||
    nextPayment.status !== currentPayment.status ||
    nextPayment.provider !== currentPayment.provider ||
    nextPayment.providerPaymentId !== currentPayment.providerPaymentId ||
    nextPayment.providerPreferenceId !== currentPayment.providerPreferenceId ||
    String(nextPayment.paidAt || '') !== String(currentPayment.paidAt || '');

  return {
    hasChanged,
    payment: nextPayment,
  };
}

function arePaymentEventsEquivalent(left, right) {
  return (
    left.type === right.type &&
    left.provider === right.provider &&
    left.status === right.status &&
    left.providerEvent === right.providerEvent &&
    left.providerPaymentId === right.providerPaymentId
  );
}

function appendUniquePaymentEvents(existingEvents = [], nextEvents = []) {
  const normalizedExistingEvents = normalizeOrderPaymentEvents(existingEvents);
  const normalizedNextEvents = nextEvents
    .map((event) => normalizeOrderPaymentEvent(event))
    .filter((event) => Boolean(event.type));

  if (!normalizedNextEvents.length) {
    return normalizedExistingEvents;
  }

  const mergedEvents = [...normalizedExistingEvents];

  normalizedNextEvents.forEach((candidateEvent) => {
    if (!mergedEvents.some((existingEvent) => arePaymentEventsEquivalent(existingEvent, candidateEvent))) {
      mergedEvents.push(candidateEvent);
    }
  });

  return mergedEvents;
}

function resolveNonRegressivePaymentStatus(currentStatus, incomingStatus) {
  const current = normalizePaymentStatus(currentStatus, PAYMENT_STATUS.PENDING);
  const incoming = normalizePaymentStatus(incomingStatus, current);

  if (current === PAYMENT_STATUS.PAID && incoming !== PAYMENT_STATUS.PAID) {
    return current;
  }

  if (
    [PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED].includes(current) &&
    incoming === PAYMENT_STATUS.PENDING
  ) {
    return current;
  }

  return incoming;
}

function sumAsaasRefunds(refunds = []) {
  if (!Array.isArray(refunds)) {
    return 0;
  }

  return Number(
    refunds
      .filter((refund) => ['DONE', 'PENDING'].includes(String(refund?.status || '').trim().toUpperCase()))
      .reduce((sum, refund) => sum + Number(refund?.value || 0), 0)
      .toFixed(2),
  );
}

function resolveAsaasRefundedAmount(asaasPayment = {}, providerEvent = '') {
  const refundsAmount = sumAsaasRefunds(asaasPayment?.refunds);

  if (refundsAmount > 0) {
    return refundsAmount;
  }

  if (String(providerEvent || '').trim().toUpperCase() === 'PAYMENT_REFUNDED') {
    return Number(Number(asaasPayment?.value || 0).toFixed(2));
  }

  return 0;
}

function buildAsaasWebhookPaymentPatch(
  existingOrder,
  asaasPayment,
  providerEvent = '',
  occurredAt = new Date(),
) {
  const currentPayment = normalizeOrderPayment(existingOrder?.payment || {}, existingOrder?.total || 0);
  const currentPaymentEvents = normalizeOrderPaymentEvents(existingOrder?.paymentEvents || []);
  const providerMappedStatus = mapAsaasPaymentStatus(asaasPayment?.status);
  const nextStatus = resolveNonRegressivePaymentStatus(currentPayment.status, providerMappedStatus);
  const refundedAmount = Math.max(
    Number(currentPayment.refundedAmount || 0),
    resolveAsaasRefundedAmount(asaasPayment, providerEvent),
  );
  const nextPayment = normalizeOrderPayment(
    {
      ...currentPayment,
      provider: PAYMENT_PROVIDERS.ASAAS,
      status: nextStatus,
      amount: Number(Number(existingOrder?.total || currentPayment.amount || 0).toFixed(2)),
      grossAmount: Number(
        Number(existingOrder?.total || currentPayment.grossAmount || currentPayment.amount || 0).toFixed(2),
      ),
      providerPaymentId: String(asaasPayment?.id || currentPayment.providerPaymentId || '').trim(),
      providerCustomerId: String(asaasPayment?.customer || currentPayment.providerCustomerId || '').trim(),
      invoiceUrl: String(asaasPayment?.invoiceUrl || currentPayment.invoiceUrl || '').trim(),
      bankSlipUrl: String(asaasPayment?.bankSlipUrl || currentPayment.bankSlipUrl || '').trim(),
      refundedAmount,
      paidAt:
        nextStatus === PAYMENT_STATUS.PAID
          ? currentPayment.paidAt ||
            asaasPayment?.confirmedDate ||
            asaasPayment?.clientPaymentDate ||
            occurredAt
          : currentPayment.paidAt || null,
      confirmedAt:
        currentPayment.confirmedAt ||
        asaasPayment?.confirmedDate ||
        asaasPayment?.clientPaymentDate ||
        null,
      receivedAt:
        currentPayment.receivedAt ||
        asaasPayment?.creditDate ||
        asaasPayment?.clientPaymentDate ||
        asaasPayment?.paymentDate ||
        null,
      providerUpdatedAt: occurredAt,
      updatedAt: occurredAt,
    },
    existingOrder?.total || currentPayment.amount || 0,
  );

  const statusEventType =
    nextStatus !== providerMappedStatus
      ? ''
      : nextStatus === PAYMENT_STATUS.PAID
      ? 'payment_paid'
      : nextStatus === PAYMENT_STATUS.FAILED
        ? 'payment_failed'
        : nextStatus === PAYMENT_STATUS.CANCELLED
          ? 'payment_cancelled'
          : '';
  const normalizedProviderEvent = String(providerEvent || '').trim().toUpperCase();
  const refundEventType =
    normalizedProviderEvent === 'PAYMENT_REFUNDED' ||
    normalizedProviderEvent === 'PAYMENT_PARTIALLY_REFUNDED'
      ? 'payment_refunded'
      : '';
  const nextEvents = appendUniquePaymentEvents(currentPaymentEvents, [
    {
      type: 'webhook_received',
      provider: PAYMENT_PROVIDERS.ASAAS,
      status: nextStatus,
      providerEvent: String(providerEvent || '').trim(),
      providerPaymentId: String(asaasPayment?.id || currentPayment.providerPaymentId || '').trim(),
      occurredAt,
      meta: {
        externalReference: String(asaasPayment?.externalReference || '').trim(),
        providerStatus: String(asaasPayment?.status || '').trim(),
        mappedStatus: providerMappedStatus,
      },
    },
    ...(statusEventType
      ? [
          {
            type: statusEventType,
            provider: PAYMENT_PROVIDERS.ASAAS,
            status: nextStatus,
            providerEvent: String(providerEvent || '').trim(),
            providerPaymentId: String(asaasPayment?.id || currentPayment.providerPaymentId || '').trim(),
            occurredAt,
            meta: {
              externalReference: String(asaasPayment?.externalReference || '').trim(),
            },
          },
        ]
      : []),
    ...(refundEventType
      ? [
          {
            type: refundEventType,
            provider: PAYMENT_PROVIDERS.ASAAS,
            status: nextStatus,
            providerEvent: String(providerEvent || '').trim(),
            providerPaymentId: String(asaasPayment?.id || currentPayment.providerPaymentId || '').trim(),
            occurredAt,
            meta: {
              externalReference: String(asaasPayment?.externalReference || '').trim(),
              refundedAmount,
            },
          },
        ]
      : []),
  ]);
  const hasChanged =
    nextPayment.method !== currentPayment.method ||
    nextPayment.status !== currentPayment.status ||
    nextPayment.provider !== currentPayment.provider ||
    nextPayment.grossAmount !== currentPayment.grossAmount ||
    nextPayment.refundedAmount !== currentPayment.refundedAmount ||
    nextPayment.providerPaymentId !== currentPayment.providerPaymentId ||
    nextPayment.providerCustomerId !== currentPayment.providerCustomerId ||
    nextPayment.invoiceUrl !== currentPayment.invoiceUrl ||
    nextPayment.bankSlipUrl !== currentPayment.bankSlipUrl ||
    String(nextPayment.paidAt || '') !== String(currentPayment.paidAt || '') ||
    String(nextPayment.confirmedAt || '') !== String(currentPayment.confirmedAt || '') ||
    String(nextPayment.receivedAt || '') !== String(currentPayment.receivedAt || '') ||
    String(nextPayment.providerUpdatedAt || '') !== String(currentPayment.providerUpdatedAt || '') ||
    String(nextPayment.updatedAt || '') !== String(currentPayment.updatedAt || '') ||
    nextEvents.length !== currentPaymentEvents.length;

  return {
    hasChanged,
    payment: nextPayment,
    paymentEvents: nextEvents,
  };
}

export async function listTenantProfessionals(businessId) {
  await assertBusinessExists(businessId);
  return (await listProfessionalsByBusinessId(businessId)).map(toPlainRecord);
}

export async function createTenantProfessional(businessId, payload) {
  const business = await assertBusinessExists(businessId);
  const created = await createProfessionalRecord({ ...payload, businessId });
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PROFESSIONAL_CREATED, 'created');
  return toPlainRecord(created);
}

export async function updateTenantProfessional(businessId, id, payload) {
  const business = await assertBusinessExists(businessId);
  const existing = await findProfessionalById(id);
  assertTenantScope(existing, businessId, 'Profissional');
  const updated = await updateProfessionalRecordByBusinessId(businessId, id, payload);
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PROFESSIONAL_UPDATED);
  return toPlainRecord(updated);
}

export async function deleteTenantProfessional(businessId, id) {
  const business = await assertBusinessExists(businessId);
  const existing = await findProfessionalById(id);
  assertTenantScope(existing, businessId, 'Profissional');
  await deleteProfessionalRecordByBusinessId(businessId, id);
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PROFESSIONAL_DELETED, 'deleted');
  return { deleted: true, id };
}

export async function listTenantAppointmentServices(businessId) {
  await assertBusinessExists(businessId);
  return (await listAppointmentServicesByBusinessId(businessId)).map(toPlainRecord);
}

export async function createTenantAppointmentService(businessId, payload) {
  const business = await assertBusinessExists(businessId);
  const created = await createAppointmentServiceRecord({ ...payload, businessId });
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_CREATED, 'created');
  return toPlainRecord(created);
}

export async function updateTenantAppointmentService(businessId, id, payload) {
  const business = await assertBusinessExists(businessId);
  const existing = await findAppointmentServiceById(id);
  assertTenantScope(existing, businessId, 'Servico');
  const updated = await updateAppointmentServiceRecordByBusinessId(businessId, id, payload);
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_UPDATED);
  return toPlainRecord(updated);
}

export async function deleteTenantAppointmentService(businessId, id) {
  const business = await assertBusinessExists(businessId);
  const existing = await findAppointmentServiceById(id);
  assertTenantScope(existing, businessId, 'Servico');
  await deleteAppointmentServiceRecordByBusinessId(businessId, id);
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_DELETED, 'deleted');
  return { deleted: true, id };
}

export async function listTenantProducts(businessId) {
  await assertBusinessExists(businessId);
  return (await listProductsByBusinessId(businessId)).map(serializeProductRecord);
}

export async function createTenantProduct(businessId, payload) {
  const business = await assertBusinessExists(businessId);
  const created = await createProductRecord({
    ...normalizeProductMutationPayload(payload),
    businessId,
  });
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PRODUCT_CREATED, 'created');
  return serializeProductRecord(created);
}

export async function updateTenantProduct(businessId, id, payload) {
  const business = await assertBusinessExists(businessId);
  const existing = await findProductById(id);
  assertTenantScope(existing, businessId, 'Produto');
  const updated = await updateProductRecordByBusinessId(
    businessId,
    id,
    normalizeProductMutationPayload(payload, existing.measurementUnit),
  );
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PRODUCT_UPDATED);
  return serializeProductRecord(updated);
}

export async function deleteTenantProduct(businessId, id) {
  const business = await assertBusinessExists(businessId);
  const existing = await findProductById(id);
  assertTenantScope(existing, businessId, 'Produto');
  await deleteProductRecordByBusinessId(businessId, id);
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PRODUCT_DELETED, 'deleted');
  return { deleted: true, id };
}

export async function listPublicProductsBySlug(slug) {
  const business = await assertPublicBusinessBySlug(slug);
  return (await listProductsByBusinessId(business._id, { activeOnly: true })).map(serializeProductRecord);
}

export async function createPublicAppointmentRequest(slug, payload) {
  const business = await assertPublicBusinessBySlug(slug);
  let professionalName = String(payload.professionalName || '').trim();
  let serviceName = String(payload.serviceName || '').trim();

  if (payload.professionalId) {
    const professional = await findProfessionalById(payload.professionalId);
    assertTenantScope(professional, business._id, 'Profissional');
    professionalName = professional.name;
  }

  if (payload.serviceId) {
    const appointmentService = await findAppointmentServiceById(payload.serviceId);
    assertTenantScope(appointmentService, business._id, 'Servico');
    serviceName = appointmentService.name;
  }

  const created = await createAppointmentRequestRecord({
    ...payload,
    businessId: business._id,
    professionalName,
    serviceName,
    status: 'pending',
  });

  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.APPOINTMENT_CREATED, 'created');
  return toPlainRecord(created);
}

export async function listTenantAppointmentRequests(businessId) {
  await assertBusinessExists(businessId);
  return (await listAppointmentRequestsByBusinessId(businessId)).map(toPlainRecord);
}

export async function updateTenantAppointmentRequestStatus(businessId, id, status) {
  const business = await assertBusinessExists(businessId);
  const existing = await findAppointmentRequestById(id);
  assertTenantScope(existing, businessId, 'Solicitacao de agendamento');
  const updated = await updateAppointmentRequestRecordByBusinessId(businessId, id, { status });
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.APPOINTMENT_STATUS_UPDATED);
  return toPlainRecord(updated);
}

function calculateOrderTotal(items = []) {
  return sumMoneyValues(items.map((item) => item.itemTotal || 0));
}

async function buildOrderItemsSnapshot(businessId, items = []) {
  const requestedItems = Array.isArray(items) ? items : [];
  const productIds = requestedItems
    .map((item) => String(item.productId || '').trim())
    .filter(Boolean);
  const productsById = new Map(
    (
      productIds.length
        ? await listProductsByBusinessIdAndIds(businessId, productIds, { activeOnly: true })
        : []
    ).map((product) => [String(product._id), serializeProductRecord(product)]),
  );

  return requestedItems.map((item) => {
    const requestedProductId = String(item.productId || '').trim();
    const product = requestedProductId ? productsById.get(requestedProductId) : null;
    const measurementUnit = normalizeMeasurementUnit(product?.measurementUnit || item.measurementUnit);
    const quantity = Number(item.quantity || 0);

    if (!isValidMeasurementQuantity(quantity, measurementUnit)) {
      throw new AppError(
        'Quantidade invalida para a unidade de medida do produto.',
        400,
        'order_item_quantity_invalid',
      );
    }

    if (requestedProductId && !product) {
      throw new AppError('Produto não encontrado para este tenant.', 404, 'order_product_not_found');
    }

    if (product && product.isAvailable === false) {
      throw new AppError(
        'Um dos produtos selecionados está indisponível no momento.',
        400,
        'order_product_unavailable',
      );
    }

    const unitPrice = Number(product?.price ?? item.unitPrice ?? 0);
    const itemTotal = calculateMeasuredItemTotal(unitPrice, quantity);

    return {
      productId: requestedProductId || undefined,
      name: String(product?.name || item.name || '').trim(),
      quantity,
      unitPrice,
      measurementUnit,
      displayQuantity:
        String(item.displayQuantity || '').trim() ||
        buildLegacyDisplayQuantity(quantity, measurementUnit),
      itemTotal,
      notes: String(item.notes || '').trim(),
    };
  });
}

export async function createPublicOrder(slug, payload) {
  const business = await assertPublicBusinessBySlug(slug);
  const orderItems = await buildOrderItemsSnapshot(business._id, payload.items || []);
  const total = calculateOrderTotal(orderItems);
  const receivedAt = new Date();
  const checkoutToken = createPublicCheckoutToken();
  const checkoutTokenHash = hashPublicCheckoutToken(checkoutToken);
  const storedPaymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
  const normalizedPaymentMethod = normalizeLegacyPaymentMethodAlias(
    payload?.payment?.method,
    payload?.deliveryType,
    storedPaymentSettings?.methods,
  );
  const { deliveryType, paymentMethod } = validatePaymentMethodForDeliveryType(
    payload?.deliveryType,
    normalizedPaymentMethod,
  );
  const normalizedPayload = {
    ...payload,
    deliveryType,
    customerDocument: resolveCheckoutCustomerDocument(payload),
    payment: {
      ...(payload?.payment || {}),
      method: paymentMethod,
    },
  };
  const payment = await buildPublicOrderPaymentSnapshot(business, normalizedPayload, total, receivedAt);
  const customerDocument = requiresAsaasCustomerDocument(payment)
    ? assertValidCheckoutCustomerDocument(normalizedPayload)
    : normalizedPayload.customerDocument;
  logger.info(
    {
      businessId: String(business._id || ''),
      slug: business.slug || '',
      paymentMethod: payment.method,
      provider: payment.provider,
      paymentArchitecture: payment.paymentArchitecture || 'manual',
    },
    'Resolved public order payment provider',
  );
  const created = await createOrderRecord({
    ...normalizedPayload,
    businessId: business._id,
    items: orderItems,
    total,
    status: 'received',
    receivedAt,
    payment,
    publicCheckoutTokenHash: checkoutTokenHash,
    publicCheckoutTokenIssuedAt: receivedAt,
  });
  let finalOrder = created;

  if (payment.provider === PAYMENT_PROVIDERS.MERCADO_PAGO) {
    try {
      const preference = await createMercadoPagoCheckoutPreference({
        business,
        order: serializeOrderRecord(created),
        paymentMethod: payment.method,
        mercadoPagoSettings: storedPaymentSettings.mercadoPago,
      });

      finalOrder = await updateOrderRecordByBusinessId(business._id, created._id, {
        payment: normalizeOrderPayment(
          {
            ...payment,
            providerPreferenceId: preference.preferenceId,
            checkoutUrl: preference.checkoutUrl,
            updatedAt: new Date(),
          },
          total,
        ),
      });
    } catch (error) {
      await updateOrderRecordByBusinessId(business._id, created._id, {
        payment: normalizeOrderPayment(
          {
            ...payment,
            status: PAYMENT_STATUS.FAILED,
            updatedAt: new Date(),
          },
          total,
        ),
      });
      throw error;
    }
  }

  if (payment.provider === PAYMENT_PROVIDERS.ASAAS) {
    try {
      const financeSettings = await getPlatformFinanceSettings();
      const asaasContext = resolveAsaasProviderContext({
        business,
        paymentSettings: storedPaymentSettings,
        financeSettings,
      });
      const customerName = String(payload.customerName || '').trim();
      const customerPhone = String(payload.customerPhone || '').trim();
      const customerEmail = String(payload.customerEmail || payload.email || '').trim();
      const customer = await resolveOrCreateAsaasPaymentCustomer({
        businessId: business._id,
        apiKey: asaasContext.apiKey,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        document: customerDocument,
      });
      const providerCustomerId = String(customer.id || '').trim();

      if (!providerCustomerId) {
        throw new AppError('Asaas não retornou um customer válido.', 502, 'asaas_customer_missing_id');
      }
      const effectiveSplitSettings = resolveEffectiveAsaasSplitSettings(
        storedPaymentSettings,
        financeSettings,
      );
      const centralizedMode = usesCentralizedPaymentArchitecture(financeSettings);
      const feeBreakdown = centralizedMode
        ? calculatePlatformFeeBreakdown(total, effectiveSplitSettings.platformFeePercent)
        : buildAsaasSplitRules({
            total,
            platformFeePercent: effectiveSplitSettings.enabled
              ? effectiveSplitSettings.platformFeePercent
              : 0,
            platformWalletId: effectiveSplitSettings.platformWalletId,
          });
      const {
        platformFeeAmount = 0,
        tenantNetAmount = total,
        split = [],
      } = feeBreakdown;
      const billingType = resolveAsaasBillingType(payment.method);
      const externalReference = buildAsaasExternalReference(business._id, created._id);
      logger.info(
        {
          businessId: String(business._id || ''),
          orderId: String(created._id || ''),
          paymentMethod: payment.method,
          billingType,
          paymentArchitecture: asaasContext.paymentArchitecture,
          usesCentralizedAccount: asaasContext.usesCentralizedAccount,
        },
        'Creating Asaas payment charge for public order',
      );
      const charge = await createAsaasPaymentCharge({
        apiKey: asaasContext.apiKey,
        charge: {
          customer: providerCustomerId,
          billingType,
          value: total,
          dueDate: receivedAt.toISOString().slice(0, 10),
          description: business.name ? `Pedido em ${business.name}` : 'Pedido TapLink',
          externalReference,
          ...(!centralizedMode && split.length ? { split } : {}),
        },
      });
      logger.info(
        {
          businessId: String(business._id || ''),
          orderId: String(created._id || ''),
          providerPaymentId: String(charge.id || '').trim(),
          externalReference,
          paymentMethod: payment.method,
          paymentArchitecture: asaasContext.paymentArchitecture,
        },
        'Asaas payment charge created for public order',
      );
      const providerPaymentId = String(charge.id || '').trim();
      const invoiceUrl = String(charge.invoiceUrl || '').trim();

      let nextPayment = normalizeOrderPayment(
        {
          ...payment,
          paymentArchitecture: asaasContext.paymentArchitecture,
          providerPaymentId,
          providerCustomerId,
          checkoutUrl: invoiceUrl,
          invoiceUrl,
          bankSlipUrl: String(charge.bankSlipUrl || '').trim(),
          grossAmount: total,
          platformFeeAmount,
          tenantNetAmount,
          refundedAmount: 0,
          providerUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
        total,
      );
      const nextPaymentEvents = [
        {
          type: 'charge_created',
          provider: PAYMENT_PROVIDERS.ASAAS,
          status: PAYMENT_STATUS.PENDING,
          providerPaymentId,
          occurredAt: receivedAt,
          meta: {
            externalReference,
            method: payment.method,
            paymentArchitecture: asaasContext.paymentArchitecture,
          },
        },
      ];

      if (payment.method === PAYMENT_METHODS.PIX) {
        try {
          const pixQrCode = await getAsaasPixQrCode({
            apiKey: asaasContext.apiKey,
            paymentId: providerPaymentId,
          });
          logger.info(
            {
              businessId: String(business._id || ''),
              orderId: String(created._id || ''),
              providerPaymentId,
              paymentProvider: PAYMENT_PROVIDERS.ASAAS,
              hasEncodedImage: Boolean(pixQrCode.encodedImage),
              hasPayload: Boolean(pixQrCode.payload),
              encodedImageLength: pixQrCode.encodedImage ? pixQrCode.encodedImage.length : 0,
            },
            'Retrieved Asaas Pix QR code for public order',
          );

          nextPayment = normalizeOrderPayment(
            {
              ...nextPayment,
              pixCopyPaste: pixQrCode.payload,
              pixQrCode: normalizeAsaasPixQrCodeImage(pixQrCode.encodedImage),
            },
            total,
          );
        } catch (error) {
          if (!invoiceUrl) {
            throw error;
          }

          logger.warn(
            {
              businessId: String(business._id || ''),
              orderId: String(created._id || ''),
              providerPaymentId,
              paymentMethod: payment.method,
              paymentArchitecture: asaasContext.paymentArchitecture,
              code: error?.code,
              statusCode: error?.statusCode,
            },
            'Failed to retrieve Asaas Pix QR code for public order, keeping hosted invoice fallback',
          );
          nextPaymentEvents.push({
            type: 'pix_qr_unavailable',
            provider: PAYMENT_PROVIDERS.ASAAS,
            status: PAYMENT_STATUS.PENDING,
            providerPaymentId,
            message: String(error?.message || '').trim(),
            occurredAt: new Date(),
            meta: {
              code: String(error?.code || '').trim(),
              externalReference,
              method: payment.method,
              invoiceUrl,
              paymentArchitecture: asaasContext.paymentArchitecture,
            },
          });
        }
      }

      finalOrder = await updateOrderRecordByBusinessId(business._id, created._id, {
        payment: nextPayment,
        paymentEvents: appendUniquePaymentEvents(created.paymentEvents || [], nextPaymentEvents),
      });

      const storedPayment = await upsertPaymentByProviderPaymentId(
        PAYMENT_PROVIDERS.ASAAS,
        providerPaymentId,
        buildAsaasPaymentReferencePayload({
          businessId: business._id,
          orderId: created._id,
          payment: nextPayment,
          providerPayment: charge,
          providerStatus: charge.status,
          billingType,
          externalReference,
          occurredAt: new Date(),
        }),
      );

      await syncTenantLedgerForPayment(storedPayment, {
        businessPaymentSettings: storedPaymentSettings,
        financeSettings,
        providerEvent: 'PAYMENT_CREATED',
        occurredAt: new Date(),
      });
    } catch (error) {
      logger.warn(
        {
          businessId: String(business._id || ''),
          orderId: String(created._id || ''),
          paymentMethod: payment.method,
          provider: payment.provider,
          paymentArchitecture: payment.paymentArchitecture,
          code: error?.code,
          statusCode: error?.statusCode,
        },
        'Failed to create Asaas public checkout charge',
      );
      await updateOrderRecordByBusinessId(business._id, created._id, {
        payment: normalizeOrderPayment(
          {
            ...payment,
            status: PAYMENT_STATUS.FAILED,
            updatedAt: new Date(),
          },
          total,
        ),
        paymentEvents: appendUniquePaymentEvents(created.paymentEvents || [], [
          {
            type: 'payment_failed',
            provider: PAYMENT_PROVIDERS.ASAAS,
            status: PAYMENT_STATUS.FAILED,
            providerPaymentId: payment.providerPaymentId || '',
            occurredAt: new Date(),
            message: String(error?.message || '').trim(),
          },
        ]),
      });
      throw error;
    }
  }

  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.ORDER_CREATED, 'created');
  return buildPublicOrderCheckoutResponse(
    finalOrder,
    isRecoverablePublicOrderPayment(finalOrder?.payment) ? checkoutToken : '',
  );
}

export async function getPublicOrderPaymentByCheckoutToken(slug, checkoutToken) {
  const business = await assertPublicBusinessBySlug(slug);
  const normalizedCheckoutToken = String(checkoutToken || '').trim();

  if (!normalizedCheckoutToken) {
    throw new AppError('Pagamento não encontrado.', 404, 'public_order_payment_not_found');
  }

  const order = await findOrderByBusinessIdAndCheckoutTokenHash(
    business._id,
    hashPublicCheckoutToken(normalizedCheckoutToken),
  );

  if (!order || !isRecoverablePublicOrderPayment(order.payment || {})) {
    throw new AppError('Pagamento não encontrado.', 404, 'public_order_payment_not_found');
  }

  return serializePublicOrderPaymentRecovery(order, business);
}

export async function listTenantOrders(businessId) {
  await assertBusinessExists(businessId);
  return (await listOrdersByBusinessId(businessId)).map(serializeOrderRecord);
}

export async function updateTenantOrderStatus(businessId, id, status) {
  const business = await assertBusinessExists(businessId);
  const existing = await findOrderById(id);
  assertTenantScope(existing, businessId, 'Pedido');
  const updated = await updateOrderRecordByBusinessId(
    businessId,
    id,
    buildOrderStatusTimestampPatch(existing, status),
  );
  if (!updated) {
    throw new AppError('Pedido não encontrado', 404, 'module_resource_not_found');
  }
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.ORDER_STATUS_UPDATED);
  return serializeOrderRecord(updated);
}

export async function updateTenantOrderPaymentStatus(businessId, id, status) {
  const business = await assertBusinessExists(businessId);
  const existing = await findOrderById(id);
  assertTenantScope(existing, businessId, 'Pedido');
  const updated = await updateOrderRecordByBusinessId(
    businessId,
    id,
    buildOrderPaymentStatusPatch(existing, status),
  );

  if (!updated) {
    throw new AppError('Pedido não encontrado', 404, 'module_resource_not_found');
  }

  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.ORDER_PAYMENT_UPDATED);
  return serializeOrderRecord(updated);
}

export async function syncMercadoPagoOrderPaymentWebhook(
  businessId,
  id,
  paymentSnapshot,
  occurredAt = new Date(),
) {
  const business = await assertBusinessExists(businessId);
  const existing = await findOrderById(id);
  assertTenantScope(existing, businessId, 'Pedido');
  const nextPaymentPatch = buildMercadoPagoWebhookPaymentPatch(existing, paymentSnapshot, occurredAt);

  if (!nextPaymentPatch.hasChanged) {
    return serializeOrderRecord(existing);
  }

  const updated = await updateOrderRecordByBusinessId(businessId, id, {
    payment: nextPaymentPatch.payment,
  });

  if (!updated) {
    throw new AppError('Pedido não encontrado', 404, 'module_resource_not_found');
  }

  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.ORDER_PAYMENT_UPDATED);
  return serializeOrderRecord(updated);
}

export async function syncAsaasOrderPaymentWebhook(
  businessId,
  id,
  asaasPayment,
  providerEvent = '',
  occurredAt = new Date(),
) {
  const business = await assertBusinessExists(businessId);
  const existing = await findOrderById(id);
  assertTenantScope(existing, businessId, 'Pedido');
  const storedPaymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
  const financeSettings = await getPlatformFinanceSettings();

  if (existing.payment?.provider !== PAYMENT_PROVIDERS.ASAAS) {
    throw new AppError('Pedido não configurado para Asaas', 404, 'module_resource_not_found');
  }

  const nextPaymentPatch = buildAsaasWebhookPaymentPatch(
    existing,
    asaasPayment,
    providerEvent,
    occurredAt,
  );
  nextPaymentPatch.payment = enrichAsaasPaymentFinancials(nextPaymentPatch.payment, existing.total || 0, {
    businessPaymentSettings: storedPaymentSettings,
    financeSettings,
  });
  const existingNormalizedPayment = normalizeOrderPayment(existing.payment || {}, existing.total || 0);
  if (
    nextPaymentPatch.payment.grossAmount !== existingNormalizedPayment.grossAmount ||
    nextPaymentPatch.payment.platformFeeAmount !== existingNormalizedPayment.platformFeeAmount ||
    nextPaymentPatch.payment.tenantNetAmount !== existingNormalizedPayment.tenantNetAmount ||
    nextPaymentPatch.payment.paymentArchitecture !== existingNormalizedPayment.paymentArchitecture
  ) {
    nextPaymentPatch.hasChanged = true;
  }

  if (!nextPaymentPatch.hasChanged) {
    const storedPayment = await upsertPaymentByProviderPaymentId(
      PAYMENT_PROVIDERS.ASAAS,
      nextPaymentPatch.payment.providerPaymentId,
      buildAsaasPaymentReferencePayload({
        businessId,
        orderId: id,
        payment: nextPaymentPatch.payment,
        providerPayment: asaasPayment,
        providerStatus: asaasPayment?.status,
        billingType: String(asaasPayment?.billingType || '').trim(),
        externalReference: String(asaasPayment?.externalReference || '').trim(),
        occurredAt,
      }),
    );

    await syncTenantLedgerForPayment(storedPayment, {
      businessPaymentSettings: storedPaymentSettings,
      financeSettings,
      providerEvent,
      occurredAt,
    });

    return serializeOrderRecord(existing);
  }

  const updated = await updateOrderRecordByBusinessId(businessId, id, {
    payment: nextPaymentPatch.payment,
    paymentEvents: nextPaymentPatch.paymentEvents,
  }, { includeArchived: true });

  if (!updated) {
    throw new AppError('Pedido não encontrado', 404, 'module_resource_not_found');
  }

  const storedPayment = await upsertPaymentByProviderPaymentId(
    PAYMENT_PROVIDERS.ASAAS,
    nextPaymentPatch.payment.providerPaymentId,
    buildAsaasPaymentReferencePayload({
      businessId,
      orderId: id,
      payment: nextPaymentPatch.payment,
      providerPayment: asaasPayment,
      providerStatus: asaasPayment?.status,
      billingType: String(asaasPayment?.billingType || '').trim(),
      externalReference: String(asaasPayment?.externalReference || '').trim(),
      occurredAt,
    }),
  );

  await syncTenantLedgerForPayment(storedPayment, {
    businessPaymentSettings: storedPaymentSettings,
    financeSettings,
    providerEvent,
    occurredAt,
  });

  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PAYMENT_UPDATED);
  return serializeOrderRecord(updated);
}

export async function archiveTenantOrder(businessId, id) {
  const business = await assertBusinessExists(businessId);
  const existing = await findOrderById(id);
  assertTenantScope(existing, businessId, 'Pedido');
  const archived = await archiveOrderRecordByBusinessId(businessId, id, new Date());
  if (!archived) {
    throw new AppError('Pedido não encontrado', 404, 'module_resource_not_found');
  }
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.ORDER_ARCHIVED, 'archived');
  return {
    archived: true,
    id: String(archived._id || id),
    archivedAt: archived.archivedAt,
  };
}
