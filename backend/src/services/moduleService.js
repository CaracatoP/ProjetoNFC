import { AppError } from '../utils/appError.js';
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
  normalizeOrderPayment,
  normalizeOrderPaymentEvent,
  normalizeOrderPaymentEvents,
  normalizePaymentStatus,
  resolveBusinessPaymentSettings,
  resolveDefaultPaymentMethod,
} from '../../../shared/utils/businessPayment.js';
import {
  buildLegacyDisplayQuantity,
  calculateMeasuredItemTotal,
  isValidMeasurementQuantity,
  normalizeMeasurementUnit,
  normalizeProductMeasurement,
} from '../../../shared/utils/productMeasurement.js';
import { TENANT_REALTIME_KINDS } from '../../../shared/constants/tenantRealtime.js';
import { buildPixPayload } from '../../../shared/utils/pix.js';
import { publishTenantUpdated } from './tenantRealtimeService.js';
import { createMercadoPagoCheckoutPreference } from './mercadoPagoService.js';
import { getFinanceSettingsRecord } from '../repositories/systemSettingRepository.js';
import {
  getDeclaredHostedCheckoutProvider,
  isAsaasProviderConnected,
  isMercadoPagoProviderConnected,
} from '../utils/paymentProvider.js';
import {
  buildAsaasExternalReference,
  buildAsaasSplitRules,
  createAsaasCustomer,
  createAsaasPaymentCharge,
  getAsaasPixQrCode,
  mapAsaasPaymentStatus,
} from './asaasService.js';
import { resolveEffectiveAsaasSplitSettings } from './adminFinanceService.js';

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
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  return business;
}

async function assertPublicBusinessBySlug(slug) {
  const business = await findBusinessBySlugStrict(slug);

  if (!business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  if (![BUSINESS_STATUS.ACTIVE, BUSINESS_STATUS.DRAFT].includes(business.status)) {
    throw new AppError('Este site esta temporariamente indisponivel.', 423, 'business_inactive');
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
    throw new AppError(`${resourceLabel} nao encontrado`, 404, 'module_resource_not_found');
  }

  if (String(entity.businessId) !== String(businessId)) {
    throw new AppError('Este recurso pertence a outro tenant', 404, 'module_resource_not_found');
  }
}

function serializeProductRecord(item) {
  const record = normalizeProductMeasurement(toPlainRecord(item));

  return {
    ...record,
    price: Number(record.price || 0),
    image: record.image || '',
    imagePublicId: record.imagePublicId || '',
    category: record.category || '',
    active: record.active !== false,
    options: Array.isArray(record.options) ? record.options : [],
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
      ? Number(Number(item.itemTotal).toFixed(2))
      : calculateMeasuredItemTotal(unitPrice, quantity),
    notes: item.notes || '',
  };
}

function serializeOrderRecord(item) {
  const record = toPlainRecord(item);
  const items = Array.isArray(record.items) ? record.items.map(serializeOrderItem) : [];
  const total = Number(
    (
      Number(record.total || 0) ||
      items.reduce((sum, orderItem) => sum + Number(orderItem.itemTotal || 0), 0)
    ).toFixed(2),
  );

  return {
    ...record,
    customerName: record.customerName || '',
    customerPhone: record.customerPhone || '',
    items,
    total,
    deliveryType: record.deliveryType || 'pickup',
    address: record.address || '',
    status: record.status || 'received',
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    receivedAt: record.receivedAt || record.createdAt || null,
    preparingAt: record.preparingAt || null,
    readyAt: record.readyAt || null,
    deliveredAt: record.deliveredAt || null,
    cancelledAt: record.cancelledAt || null,
    notes: record.notes || '',
    payment: normalizeOrderPayment(record.payment || {}, total),
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
  const requestedMethod = String(payload?.payment?.method || '').trim().toLowerCase();

  if (requestedMethod) {
    if (!isBusinessPaymentMethodEnabled(paymentSettings, requestedMethod)) {
      throw new AppError(
        'Esta forma de pagamento nao esta disponivel para este tenant.',
        400,
        'payment_method_unavailable',
      );
    }

    return requestedMethod;
  }

  const fallbackMethod = resolveDefaultPaymentMethod(paymentSettings);

  if (!fallbackMethod) {
    throw new AppError(
      'Nenhuma forma de pagamento esta disponivel no momento.',
      400,
      'payment_method_unavailable',
    );
  }

  return fallbackMethod;
}

function resolveRequestedPaymentProvider(payload, method, paymentSettings) {
  const requestedProvider = String(payload?.payment?.provider || '').trim().toLowerCase();
  const declaredHostedProvider = getDeclaredHostedCheckoutProvider(paymentSettings);

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

  const manualPixAvailable = Boolean(paymentSettings?.methods?.pix && paymentSettings?.pix?.key);
  const hostedPixAvailable = Boolean(paymentSettings?.methods?.pix && declaredHostedProvider);

  if (
    requestedProvider &&
    [PAYMENT_PROVIDERS.ASAAS, PAYMENT_PROVIDERS.MERCADO_PAGO].includes(requestedProvider) &&
    hostedPixAvailable
  ) {
    return requestedProvider;
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
      'Pagamento online indisponivel para este tenant no momento.',
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
      'Esta forma de pagamento nao esta disponivel para este tenant.',
      400,
      'payment_method_unavailable',
    );
  }

  if (!isMercadoPagoProviderConnected(paymentSettings)) {
    throw new AppError(
      'Este tenant ainda nao concluiu a configuracao do Mercado Pago.',
      400,
      'payment_provider_unavailable',
    );
  }
}

function assertAsaasPaymentMethodAllowed(paymentSettings, method) {
  if (!getDeclaredHostedCheckoutProvider(paymentSettings)) {
    throw new AppError(
      'Pagamento online indisponivel para este tenant no momento.',
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
      'Esta forma de pagamento nao esta disponivel para este tenant.',
      400,
      'payment_method_unavailable',
    );
  }

  if (!isAsaasProviderConnected(paymentSettings)) {
    throw new AppError(
      'Este tenant ainda nao concluiu a configuracao do Asaas.',
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
      'O tenant ainda nao configurou uma chave Pix valida para este checkout.',
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

function buildAsaasPaymentSnapshot(method, amount, occurredAt = new Date()) {
  return normalizeOrderPayment(
    {
      method,
      status: PAYMENT_STATUS.PENDING,
      provider: PAYMENT_PROVIDERS.ASAAS,
      amount,
      pixCopyPaste: '',
      pixQrCodeUrl: '',
      pixQrCode: '',
      providerPaymentId: '',
      providerCustomerId: '',
      invoiceUrl: '',
      bankSlipUrl: '',
      paidAt: null,
      updatedAt: occurredAt,
    },
    amount,
  );
}

function resolveAsaasBillingType(method) {
  if (method === PAYMENT_METHODS.PIX) {
    return 'PIX';
  }

  return 'UNDEFINED';
}

function buildPublicOrderPaymentSnapshot(business, payload, amount, occurredAt = new Date()) {
  const paymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
  const method = resolveRequestedPaymentMethod(payload, paymentSettings);
  const provider = resolveRequestedPaymentProvider(payload, method, paymentSettings);

  if (provider === PAYMENT_PROVIDERS.MERCADO_PAGO) {
    assertMercadoPagoPaymentMethodAllowed(paymentSettings, method);
    return buildMercadoPagoPaymentSnapshot(method, amount, occurredAt);
  }

  if (provider === PAYMENT_PROVIDERS.ASAAS) {
    assertAsaasPaymentMethodAllowed(paymentSettings, method);
    return buildAsaasPaymentSnapshot(method, amount, occurredAt);
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

function buildAsaasWebhookPaymentPatch(
  existingOrder,
  asaasPayment,
  providerEvent = '',
  occurredAt = new Date(),
) {
  const currentPayment = normalizeOrderPayment(existingOrder?.payment || {}, existingOrder?.total || 0);
  const currentPaymentEvents = normalizeOrderPaymentEvents(existingOrder?.paymentEvents || []);
  const nextStatus = mapAsaasPaymentStatus(asaasPayment?.status);
  const nextPayment = normalizeOrderPayment(
    {
      ...currentPayment,
      provider: PAYMENT_PROVIDERS.ASAAS,
      status: nextStatus,
      amount: Number(Number(existingOrder?.total || currentPayment.amount || 0).toFixed(2)),
      providerPaymentId: String(asaasPayment?.id || currentPayment.providerPaymentId || '').trim(),
      providerCustomerId: String(asaasPayment?.customer || currentPayment.providerCustomerId || '').trim(),
      invoiceUrl: String(asaasPayment?.invoiceUrl || currentPayment.invoiceUrl || '').trim(),
      bankSlipUrl: String(asaasPayment?.bankSlipUrl || currentPayment.bankSlipUrl || '').trim(),
      paidAt:
        nextStatus === PAYMENT_STATUS.PAID
          ? currentPayment.paidAt ||
            asaasPayment?.confirmedDate ||
            asaasPayment?.clientPaymentDate ||
            occurredAt
          : currentPayment.paidAt || null,
      updatedAt: occurredAt,
    },
    existingOrder?.total || currentPayment.amount || 0,
  );

  const statusEventType =
    nextStatus === PAYMENT_STATUS.PAID
      ? 'payment_paid'
      : nextStatus === PAYMENT_STATUS.FAILED
        ? 'payment_failed'
        : nextStatus === PAYMENT_STATUS.CANCELLED
          ? 'payment_cancelled'
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
  ]);
  const hasChanged =
    nextPayment.method !== currentPayment.method ||
    nextPayment.status !== currentPayment.status ||
    nextPayment.provider !== currentPayment.provider ||
    nextPayment.providerPaymentId !== currentPayment.providerPaymentId ||
    nextPayment.providerCustomerId !== currentPayment.providerCustomerId ||
    nextPayment.invoiceUrl !== currentPayment.invoiceUrl ||
    nextPayment.bankSlipUrl !== currentPayment.bankSlipUrl ||
    String(nextPayment.paidAt || '') !== String(currentPayment.paidAt || '') ||
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
  const created = await createProductRecord({ ...payload, businessId });
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PRODUCT_CREATED, 'created');
  return serializeProductRecord(created);
}

export async function updateTenantProduct(businessId, id, payload) {
  const business = await assertBusinessExists(businessId);
  const existing = await findProductById(id);
  assertTenantScope(existing, businessId, 'Produto');
  const updated = await updateProductRecordByBusinessId(businessId, id, payload);
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
  return Number(items.reduce((sum, item) => sum + Number(item.itemTotal || 0), 0).toFixed(2));
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
      throw new AppError('Produto nao encontrado para este tenant.', 404, 'order_product_not_found');
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
  const storedPaymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
  const payment = buildPublicOrderPaymentSnapshot(business, payload, total, receivedAt);
  const created = await createOrderRecord({
    ...payload,
    businessId: business._id,
    items: orderItems,
    total,
    status: 'received',
    receivedAt,
    payment,
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
      const financeSettingsRecord = await getFinanceSettingsRecord();
      const customer = await createAsaasCustomer({
        apiKey: storedPaymentSettings.asaas.apiKeyEncrypted,
        customer: {
          name: String(payload.customerName || '').trim(),
          mobilePhone: String(payload.customerPhone || '').trim(),
        },
      });
      const effectiveSplitSettings = resolveEffectiveAsaasSplitSettings(
        storedPaymentSettings,
        financeSettingsRecord?.value,
      );
      const { platformFeeAmount, tenantNetAmount, split } = buildAsaasSplitRules({
        total,
        platformFeePercent: effectiveSplitSettings.enabled
          ? effectiveSplitSettings.platformFeePercent
          : 0,
        platformWalletId: effectiveSplitSettings.platformWalletId,
      });
      const charge = await createAsaasPaymentCharge({
        apiKey: storedPaymentSettings.asaas.apiKeyEncrypted,
        charge: {
          customer: String(customer.id || '').trim(),
          billingType: resolveAsaasBillingType(payment.method),
          value: total,
          dueDate: receivedAt.toISOString().slice(0, 10),
          description: business.name ? `Pedido em ${business.name}` : 'Pedido TapLink',
          externalReference: buildAsaasExternalReference(business._id, created._id),
          ...(split.length ? { split } : {}),
        },
      });

      let nextPayment = normalizeOrderPayment(
        {
          ...payment,
          providerPaymentId: String(charge.id || '').trim(),
          providerCustomerId: String(customer.id || '').trim(),
          invoiceUrl: String(charge.invoiceUrl || '').trim(),
          bankSlipUrl: String(charge.bankSlipUrl || '').trim(),
          platformFeeAmount,
          tenantNetAmount,
          updatedAt: new Date(),
        },
        total,
      );

      if (payment.method === PAYMENT_METHODS.PIX) {
        const pixQrCode = await getAsaasPixQrCode({
          apiKey: storedPaymentSettings.asaas.apiKeyEncrypted,
          paymentId: String(charge.id || '').trim(),
        });

        nextPayment = normalizeOrderPayment(
          {
            ...nextPayment,
            pixCopyPaste: pixQrCode.payload,
            pixQrCode: pixQrCode.encodedImage,
          },
          total,
        );
      }

      finalOrder = await updateOrderRecordByBusinessId(business._id, created._id, {
        payment: nextPayment,
        paymentEvents: appendUniquePaymentEvents(created.paymentEvents || [], [
          {
            type: 'charge_created',
            provider: PAYMENT_PROVIDERS.ASAAS,
            status: PAYMENT_STATUS.PENDING,
            providerPaymentId: String(charge.id || '').trim(),
            occurredAt: receivedAt,
            meta: {
              externalReference: buildAsaasExternalReference(business._id, created._id),
              method: payment.method,
            },
          },
        ]),
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
  return serializeOrderRecord(finalOrder);
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
    throw new AppError('Pedido nao encontrado', 404, 'module_resource_not_found');
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
    throw new AppError('Pedido nao encontrado', 404, 'module_resource_not_found');
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
    throw new AppError('Pedido nao encontrado', 404, 'module_resource_not_found');
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

  if (existing.payment?.provider !== PAYMENT_PROVIDERS.ASAAS) {
    throw new AppError('Pedido nao configurado para Asaas', 404, 'module_resource_not_found');
  }

  const nextPaymentPatch = buildAsaasWebhookPaymentPatch(
    existing,
    asaasPayment,
    providerEvent,
    occurredAt,
  );

  if (!nextPaymentPatch.hasChanged) {
    return serializeOrderRecord(existing);
  }

  const updated = await updateOrderRecordByBusinessId(businessId, id, {
    payment: nextPaymentPatch.payment,
    paymentEvents: nextPaymentPatch.paymentEvents,
  });

  if (!updated) {
    throw new AppError('Pedido nao encontrado', 404, 'module_resource_not_found');
  }

  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.PAYMENT_UPDATED);
  return serializeOrderRecord(updated);
}

export async function archiveTenantOrder(businessId, id) {
  const business = await assertBusinessExists(businessId);
  const existing = await findOrderById(id);
  assertTenantScope(existing, businessId, 'Pedido');
  const archived = await archiveOrderRecordByBusinessId(businessId, id, new Date());
  if (!archived) {
    throw new AppError('Pedido nao encontrado', 404, 'module_resource_not_found');
  }
  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.ORDER_ARCHIVED, 'archived');
  return {
    archived: true,
    id: String(archived._id || id),
    archivedAt: archived.archivedAt,
  };
}
