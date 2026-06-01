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

function buildPublicOrderPaymentSnapshot(business, payload, amount) {
  const paymentSettings = resolveBusinessPaymentSettings(business);
  const method = resolveRequestedPaymentMethod(payload, paymentSettings);

  if ([PAYMENT_METHODS.CREDIT_CARD, PAYMENT_METHODS.DEBIT_CARD].includes(method)) {
    throw new AppError(
      'Pagamento online com cartao ainda nao esta disponivel para este tenant.',
      400,
      'payment_method_unavailable',
    );
  }

  if (method === PAYMENT_METHODS.PIX) {
    return buildManualPixPaymentSnapshot(paymentSettings, amount);
  }

  return buildManualCashPaymentSnapshot(method, amount);
}

function buildOrderPaymentStatusPatch(existingOrder, status, occurredAt = new Date()) {
  const currentPayment = normalizeOrderPayment(existingOrder?.payment || {}, existingOrder?.total || 0);
  const nextStatus = normalizePaymentStatus(status, currentPayment.status);

  return {
    payment: {
      ...currentPayment,
      status: nextStatus,
      amount: Number(Number(existingOrder?.total || currentPayment.amount || 0).toFixed(2)),
      paidAt:
        nextStatus === PAYMENT_STATUS.PAID
          ? currentPayment.paidAt || occurredAt
          : currentPayment.paidAt || null,
    },
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
  const payment = buildPublicOrderPaymentSnapshot(business, payload, total);

  const created = await createOrderRecord({
    ...payload,
    businessId: business._id,
    items: orderItems,
    total,
    status: 'received',
    receivedAt,
    payment,
  });

  publishBusinessModuleEvent(business, TENANT_REALTIME_KINDS.ORDER_CREATED, 'created');
  return serializeOrderRecord(created);
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
