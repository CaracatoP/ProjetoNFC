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
  updateOrderRecordByBusinessId,
} from '../repositories/orderRepository.js';
import {
  createProductRecord,
  deleteProductRecordByBusinessId,
  findProductById,
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
import { BUSINESS_STATUS } from '../../../shared/constants/index.js';

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

function assertTenantScope(entity, businessId, resourceLabel) {
  if (!entity) {
    throw new AppError(`${resourceLabel} nao encontrado`, 404, 'module_resource_not_found');
  }

  if (String(entity.businessId) !== String(businessId)) {
    throw new AppError('Este recurso pertence a outro tenant', 404, 'module_resource_not_found');
  }
}

export async function listTenantProfessionals(businessId) {
  await assertBusinessExists(businessId);
  return (await listProfessionalsByBusinessId(businessId)).map(toPlainRecord);
}

export async function createTenantProfessional(businessId, payload) {
  await assertBusinessExists(businessId);
  const created = await createProfessionalRecord({ ...payload, businessId });
  return toPlainRecord(created);
}

export async function updateTenantProfessional(businessId, id, payload) {
  await assertBusinessExists(businessId);
  const existing = await findProfessionalById(id);
  assertTenantScope(existing, businessId, 'Profissional');
  const updated = await updateProfessionalRecordByBusinessId(businessId, id, payload);
  return toPlainRecord(updated);
}

export async function deleteTenantProfessional(businessId, id) {
  await assertBusinessExists(businessId);
  const existing = await findProfessionalById(id);
  assertTenantScope(existing, businessId, 'Profissional');
  await deleteProfessionalRecordByBusinessId(businessId, id);
  return { deleted: true, id };
}

export async function listTenantAppointmentServices(businessId) {
  await assertBusinessExists(businessId);
  return (await listAppointmentServicesByBusinessId(businessId)).map(toPlainRecord);
}

export async function createTenantAppointmentService(businessId, payload) {
  await assertBusinessExists(businessId);
  const created = await createAppointmentServiceRecord({ ...payload, businessId });
  return toPlainRecord(created);
}

export async function updateTenantAppointmentService(businessId, id, payload) {
  await assertBusinessExists(businessId);
  const existing = await findAppointmentServiceById(id);
  assertTenantScope(existing, businessId, 'Servico');
  const updated = await updateAppointmentServiceRecordByBusinessId(businessId, id, payload);
  return toPlainRecord(updated);
}

export async function deleteTenantAppointmentService(businessId, id) {
  await assertBusinessExists(businessId);
  const existing = await findAppointmentServiceById(id);
  assertTenantScope(existing, businessId, 'Servico');
  await deleteAppointmentServiceRecordByBusinessId(businessId, id);
  return { deleted: true, id };
}

export async function listTenantProducts(businessId) {
  await assertBusinessExists(businessId);
  return (await listProductsByBusinessId(businessId)).map(toPlainRecord);
}

export async function createTenantProduct(businessId, payload) {
  await assertBusinessExists(businessId);
  const created = await createProductRecord({ ...payload, businessId });
  return toPlainRecord(created);
}

export async function updateTenantProduct(businessId, id, payload) {
  await assertBusinessExists(businessId);
  const existing = await findProductById(id);
  assertTenantScope(existing, businessId, 'Produto');
  const updated = await updateProductRecordByBusinessId(businessId, id, payload);
  return toPlainRecord(updated);
}

export async function deleteTenantProduct(businessId, id) {
  await assertBusinessExists(businessId);
  const existing = await findProductById(id);
  assertTenantScope(existing, businessId, 'Produto');
  await deleteProductRecordByBusinessId(businessId, id);
  return { deleted: true, id };
}

export async function listPublicProductsBySlug(slug) {
  const business = await assertPublicBusinessBySlug(slug);
  return (await listProductsByBusinessId(business._id, { activeOnly: true })).map(toPlainRecord);
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

  return toPlainRecord(created);
}

export async function listTenantAppointmentRequests(businessId) {
  await assertBusinessExists(businessId);
  return (await listAppointmentRequestsByBusinessId(businessId)).map(toPlainRecord);
}

export async function updateTenantAppointmentRequestStatus(businessId, id, status) {
  await assertBusinessExists(businessId);
  const existing = await findAppointmentRequestById(id);
  assertTenantScope(existing, businessId, 'Solicitacao de agendamento');
  const updated = await updateAppointmentRequestRecordByBusinessId(businessId, id, { status });
  return toPlainRecord(updated);
}

function calculateOrderTotal(items = []) {
  return Number(
    items
      .reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0)
      .toFixed(2),
  );
}

export async function createPublicOrder(slug, payload) {
  const business = await assertPublicBusinessBySlug(slug);
  const total = calculateOrderTotal(payload.items || []);

  const created = await createOrderRecord({
    ...payload,
    businessId: business._id,
    total,
    status: 'received',
  });

  return toPlainRecord(created);
}

export async function listTenantOrders(businessId) {
  await assertBusinessExists(businessId);
  return (await listOrdersByBusinessId(businessId)).map(toPlainRecord);
}

export async function updateTenantOrderStatus(businessId, id, status) {
  await assertBusinessExists(businessId);
  const existing = await findOrderById(id);
  assertTenantScope(existing, businessId, 'Pedido');
  const updated = await updateOrderRecordByBusinessId(businessId, id, { status });
  return toPlainRecord(updated);
}
