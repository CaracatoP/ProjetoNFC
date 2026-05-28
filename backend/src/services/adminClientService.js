import { canAssignRoleLevel, canManageBilling, canManageUserRecord, normalizeRoleLevel, resolveBillingAccessState } from '../../../shared/utils/access.js';
import { ROLE_LEVELS } from '../../../shared/constants/access.js';
import { SUBSCRIPTION_STATUS } from '../../../shared/constants/plans.js';
import { findBusinessById } from '../repositories/businessRepository.js';
import { findPlanByCode, findSubscriptionWithPlanByBusinessId, upsertSubscriptionByBusinessId } from '../repositories/billingRepository.js';
import {
  createUser,
  findClientUserById,
  findUserByEmail,
  isUserEmailTaken,
  listClientUsers,
  updateUser,
} from '../repositories/userRepository.js';
import { AppError } from '../utils/appError.js';
import { hashPassword } from '../utils/password.js';
import { getSession } from './sessionAuthService.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function buildClientFilter(filters = {}) {
  const filter = {};

  if (normalizeText(filters.businessId)) {
    filter.businessId = normalizeText(filters.businessId);
  }

  if (normalizeText(filters.roleLevel)) {
    filter.roleLevel = Number(filters.roleLevel);
  }

  if (normalizeText(filters.q)) {
    const pattern = new RegExp(normalizeText(filters.q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  return filter;
}

function assertClientRoleAllowed(actor, desiredRoleLevel, targetUserId = '') {
  if (Number(desiredRoleLevel) < ROLE_LEVELS.CLIENT_OWNER || Number(desiredRoleLevel) > ROLE_LEVELS.VIEWER) {
    throw new AppError('Esta rota aceita apenas clientes com niveis 2 a 5', 403, 'client_role_forbidden');
  }

  if (!canAssignRoleLevel(actor, desiredRoleLevel, { targetUserId })) {
    throw new AppError('Seu usuario nao pode atribuir este nivel ao cliente', 403, 'client_role_forbidden');
  }
}

async function assertBusinessExists(businessId) {
  const business = await findBusinessById(businessId);

  if (!business) {
    throw new AppError('Negocio nao encontrado', 404, 'business_not_found');
  }

  return business;
}

async function assertEmailAvailable(email, excludedUserId = null) {
  if (await isUserEmailTaken(email, excludedUserId)) {
    throw new AppError('Ja existe um usuario com este e-mail', 409, 'client_email_conflict');
  }
}

async function assertManagedClient(actor, clientId) {
  const client = await findClientUserById(clientId);

  if (!client) {
    throw new AppError('Cliente nao encontrado', 404, 'client_not_found');
  }

  if (!canManageUserRecord(actor, client)) {
    throw new AppError('Seu usuario nao pode gerenciar este cliente', 403, 'client_forbidden');
  }

  return client;
}

function mapBillingInputToSubscriptionStatus(value) {
  const normalized = resolveBillingAccessState(value);

  switch (normalized) {
    case 'trial':
      return SUBSCRIPTION_STATUS.TRIALING;
    case 'paid':
      return SUBSCRIPTION_STATUS.ACTIVE;
    case 'overdue':
      return SUBSCRIPTION_STATUS.PAST_DUE;
    case 'suspended':
      return SUBSCRIPTION_STATUS.SUSPENDED;
    case 'cancelled':
      return SUBSCRIPTION_STATUS.CANCELED;
    default:
      return SUBSCRIPTION_STATUS.ACTIVE;
  }
}

async function buildClientResponse(userId) {
  return getSession(userId, { allowInactive: true });
}

export async function listAdminClients(actor, filters = {}) {
  const users = await listClientUsers(buildClientFilter(filters));
  const sessions = await Promise.all(users.map((user) => buildClientResponse(user._id)));

  return sessions.filter((session) => {
    if (normalizeText(filters.planCode) && session.subscription?.plan?.code !== normalizeText(filters.planCode)) {
      return false;
    }

    if (normalizeText(filters.billingStatus) && session.subscription?.status !== normalizeText(filters.billingStatus)) {
      return false;
    }

    return true;
  });
}

export async function createAdminClient(actor, payload) {
  const desiredRoleLevel = Number(payload.roleLevel);
  const businessId = normalizeText(payload.businessId);
  const email = normalizeText(payload.email).toLowerCase();

  assertClientRoleAllowed(actor, desiredRoleLevel);
  await assertBusinessExists(businessId);
  await assertEmailAvailable(email);

  const passwordHash = await hashPassword(payload.password);
  const created = await createUser({
    name: normalizeText(payload.name),
    email,
    passwordHash,
    roles: [],
    roleLevel: desiredRoleLevel,
    businessId,
    businessIds: [businessId],
    status: payload.active === false ? 'disabled' : 'active',
  });

  return buildClientResponse(created._id);
}

export async function getAdminClient(actor, clientId) {
  const client = await assertManagedClient(actor, clientId);
  return buildClientResponse(client._id);
}

export async function updateAdminClient(actor, clientId, payload) {
  const client = await assertManagedClient(actor, clientId);
  const updatePayload = {};

  if (payload.name !== undefined) {
    updatePayload.name = normalizeText(payload.name);
  }

  if (payload.email !== undefined) {
    const email = normalizeText(payload.email).toLowerCase();
    await assertEmailAvailable(email, client._id);
    updatePayload.email = email;
  }

  if (payload.businessId !== undefined) {
    const businessId = normalizeText(payload.businessId);
    await assertBusinessExists(businessId);
    updatePayload.businessId = businessId;
    updatePayload.businessIds = [businessId];
  }

  if (payload.roleLevel !== undefined) {
    assertClientRoleAllowed(actor, Number(payload.roleLevel), String(client._id));
    updatePayload.roleLevel = Number(payload.roleLevel);
  }

  if (payload.active !== undefined) {
    updatePayload.status = payload.active ? 'active' : 'disabled';
  }

  const updated = await updateUser(client._id, updatePayload);
  return buildClientResponse(updated._id);
}

export async function updateAdminClientAccessLevel(actor, clientId, roleLevel) {
  const client = await assertManagedClient(actor, clientId);
  assertClientRoleAllowed(actor, Number(roleLevel), String(client._id));
  const updated = await updateUser(client._id, { roleLevel: Number(roleLevel) });
  return buildClientResponse(updated._id);
}

export async function resetAdminClientPassword(actor, clientId, password) {
  const client = await assertManagedClient(actor, clientId);
  const passwordHash = await hashPassword(password);
  const updated = await updateUser(client._id, { passwordHash });
  return buildClientResponse(updated._id);
}

export async function updateAdminClientStatus(actor, clientId, active) {
  const client = await assertManagedClient(actor, clientId);
  const updated = await updateUser(client._id, { status: active ? 'active' : 'disabled' });
  return buildClientResponse(updated._id);
}

export async function updateAdminClientPlan(actor, clientId, planCode) {
  if (!canManageBilling(actor) || normalizeRoleLevel(actor) !== ROLE_LEVELS.SUPER_ADMIN) {
    throw new AppError('Somente o super admin pode alterar o plano do cliente', 403, 'client_plan_forbidden');
  }

  const client = await assertManagedClient(actor, clientId);
  const businessId = normalizeText(client.businessId);
  const business = await assertBusinessExists(businessId);
  const plan = await findPlanByCode(planCode);

  if (!plan) {
    throw new AppError('Plano nao encontrado', 404, 'plan_not_found');
  }

  const existingSubscription = await findSubscriptionWithPlanByBusinessId(business._id);

  await upsertSubscriptionByBusinessId(business._id, {
    businessId: business._id,
    planId: plan._id,
    status: existingSubscription?.status || SUBSCRIPTION_STATUS.ACTIVE,
    provider: existingSubscription?.provider || 'internal',
    currentPeriodStart: existingSubscription?.currentPeriodStart || new Date(),
    currentPeriodEnd: existingSubscription?.currentPeriodEnd || null,
    cancelAt: existingSubscription?.cancelAt || null,
  });

  return buildClientResponse(client._id);
}

export async function updateAdminClientBillingStatus(actor, clientId, billingStatus) {
  if (!canManageBilling(actor) || normalizeRoleLevel(actor) !== ROLE_LEVELS.SUPER_ADMIN) {
    throw new AppError('Somente o super admin pode alterar o status financeiro do cliente', 403, 'client_billing_forbidden');
  }

  const client = await assertManagedClient(actor, clientId);
  const businessId = normalizeText(client.businessId);
  const business = await assertBusinessExists(businessId);
  const existingSubscription = await findSubscriptionWithPlanByBusinessId(business._id);

  if (!existingSubscription?.planId?._id) {
    throw new AppError('Assinatura do cliente nao encontrada', 404, 'subscription_not_found');
  }

  await upsertSubscriptionByBusinessId(business._id, {
    businessId: business._id,
    planId: existingSubscription.planId._id,
    status: mapBillingInputToSubscriptionStatus(billingStatus),
    provider: existingSubscription.provider || 'internal',
    currentPeriodStart: existingSubscription.currentPeriodStart || new Date(),
    currentPeriodEnd: existingSubscription.currentPeriodEnd || null,
    cancelAt: existingSubscription.cancelAt || null,
  });

  return buildClientResponse(client._id);
}
