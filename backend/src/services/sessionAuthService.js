import {
  canEditCatalog,
  canEditOperationalSettings,
  canEditProfessionals,
  canEditServices,
  canEditTenantBasics,
  canEditTenantSensitiveSettings,
  canManageAppointments,
  canManageBilling,
  canManageOrders,
  canManageUsers,
  canUploadMedia,
  canViewCatalog,
  canViewAnalytics,
  canViewAppointments,
  canViewProfessionals,
  canViewServices,
  canViewOnly,
  canViewOrders,
  normalizeRoleLevel,
  resolveAnalyticsScope,
  resolveBillingAccessState,
  resolvePlanCapabilities,
} from '../../../shared/utils/access.js';
import { ROLE_LEVELS } from '../../../shared/constants/access.js';
import { findBusinessById } from '../repositories/businessRepository.js';
import { findSubscriptionWithPlanByBusinessId } from '../repositories/billingRepository.js';
import { findUserByEmail, findUserById, updateUser } from '../repositories/userRepository.js';
import { buildSessionUserProfile, createSessionToken } from '../utils/adminAuth.js';
import { AppError } from '../utils/appError.js';
import { verifyPassword } from '../utils/password.js';
import { ensureBootstrapAdminUser } from './systemBootstrapService.js';

function normalizeLoginIdentifier(credentials) {
  return String(credentials?.email || credentials?.username || '')
    .trim()
    .toLowerCase();
}

function resolveUserBusinessId(user) {
  if (user?.businessId) {
    return String(user.businessId);
  }

  if (Array.isArray(user?.businessIds) && user.businessIds.length > 0) {
    return String(user.businessIds[0]);
  }

  return '';
}

async function resolveBusinessSessionContext(user) {
  const businessId = resolveUserBusinessId(user);

  if (!businessId) {
    return {
      business: null,
      businessId: '',
      modules: {},
      plan: {
        code: 'free',
        name: 'Free',
        priceCents: 0,
        currency: 'BRL',
        features: [],
      },
      rawSubscriptionStatus: 'active',
    };
  }

  const [business, subscription] = await Promise.all([
    findBusinessById(businessId),
    findSubscriptionWithPlanByBusinessId(businessId),
  ]);

  const plan = subscription?.planId
    ? {
        id: String(subscription.planId._id),
        code: subscription.planId.code,
        name: subscription.planId.name,
        priceCents: subscription.planId.priceCents ?? 0,
        currency: subscription.planId.currency || 'BRL',
        features: Array.isArray(subscription.planId.features) ? subscription.planId.features : [],
        active: subscription.planId.active !== false,
      }
    : {
        code: 'free',
        name: 'Free',
        priceCents: 0,
        currency: 'BRL',
        features: [],
        active: true,
      };

  return {
    business,
    businessId,
    modules: business?.modules || {},
    plan,
    rawSubscriptionStatus: subscription?.status || 'active',
  };
}

function buildAccessContext(user, businessContext) {
  return {
    businessId: businessContext.businessId,
    billingStatus: businessContext.rawSubscriptionStatus,
    planCode: businessContext.plan.code,
    modules: businessContext.modules,
    business: businessContext.business,
    userBusinessId: resolveUserBusinessId(user),
  };
}

function buildSessionCapabilities(user, accessContext) {
  return {
    canManageUsers: canManageUsers(user),
    canManageBilling: canManageBilling(user),
    canEditTenantBasics: canEditTenantBasics(user, accessContext),
    canEditOperationalSettings: canEditOperationalSettings(user, accessContext),
    canEditTenantSensitiveSettings: canEditTenantSensitiveSettings(user, accessContext),
    canEditCatalog: canEditCatalog(user, accessContext),
    canViewCatalog: canViewCatalog(user, accessContext),
    canEditServices: canEditServices(user, accessContext),
    canViewServices: canViewServices(user, accessContext),
    canEditProfessionals: canEditProfessionals(user, accessContext),
    canViewProfessionals: canViewProfessionals(user, accessContext),
    canViewOrders: canViewOrders(user, accessContext),
    canManageOrders: canManageOrders(user, accessContext),
    canViewAppointments: canViewAppointments(user, accessContext),
    canManageAppointments: canManageAppointments(user, accessContext),
    canViewAnalytics: canViewAnalytics(user, accessContext),
    canUploadMedia: canUploadMedia(user, accessContext),
    canViewOnly: canViewOnly(user),
  };
}

async function buildResolvedSession(user) {
  const businessContext = await resolveBusinessSessionContext(user);
  const accessContext = buildAccessContext(user, businessContext);
  const billingStatus = resolveBillingAccessState(accessContext);
  const analyticsScope = resolveAnalyticsScope(user, accessContext);
  const planCapabilities = resolvePlanCapabilities(accessContext);

  return {
    user: {
      ...buildSessionUserProfile(user),
      businessId: businessContext.businessId,
    },
    business: businessContext.business
      ? {
          id: String(businessContext.business._id || businessContext.business.id),
          slug: businessContext.business.slug,
          name: businessContext.business.name,
          status: businessContext.business.status,
          segment: businessContext.business.segment || 'other',
          modules: businessContext.modules,
        }
      : null,
    subscription: {
      status: billingStatus,
      rawStatus: businessContext.rawSubscriptionStatus,
      plan: {
        ...businessContext.plan,
        capabilities: planCapabilities,
      },
    },
    access: {
      roleLevel: normalizeRoleLevel(user),
      businessId: businessContext.businessId,
      billingStatus,
      analyticsScope,
      capabilities: buildSessionCapabilities(user, accessContext),
    },
  };
}

export async function buildSessionSnapshot(user) {
  return buildResolvedSession(user);
}

function assertRoleLevelAllowed(user, allowedRoleLevels, forbiddenCode, forbiddenMessage) {
  if (!Array.isArray(allowedRoleLevels) || allowedRoleLevels.length === 0) {
    return;
  }

  const roleLevel = normalizeRoleLevel(user);

  if (!allowedRoleLevels.includes(roleLevel)) {
    throw new AppError(forbiddenMessage, 403, forbiddenCode);
  }
}

export async function authenticateSessionUser(
  credentials,
  {
    allowedRoleLevels = null,
    invalidCredentialsMessage = 'Credenciais invalidas',
    invalidCredentialsCode = 'session_invalid_credentials',
    disabledMessage = 'Este usuario esta desativado',
    disabledCode = 'session_user_disabled',
    forbiddenMessage = 'Este usuario nao pode acessar este painel',
    forbiddenCode = 'session_forbidden',
  } = {},
) {
  await ensureBootstrapAdminUser();

  const identifier = normalizeLoginIdentifier(credentials);
  const user = await findUserByEmail(identifier);
  const passwordMatches = await verifyPassword(credentials?.password, user?.passwordHash);

  if (!user || !passwordMatches) {
    throw new AppError(invalidCredentialsMessage, 401, invalidCredentialsCode);
  }

  if (user.status !== 'active') {
    throw new AppError(disabledMessage, 403, disabledCode);
  }

  assertRoleLevelAllowed(user, allowedRoleLevels, forbiddenCode, forbiddenMessage);

  await updateUser(user._id, { lastLoginAt: new Date() });

  return user;
}

export async function loginSession(credentials) {
  const user = await authenticateSessionUser(credentials, {
    invalidCredentialsMessage: 'Credenciais invalidas',
    invalidCredentialsCode: 'session_invalid_credentials',
    disabledMessage: 'Este usuario esta desativado',
    disabledCode: 'session_user_disabled',
  });

  return {
    token: createSessionToken(user),
    ...(await buildResolvedSession(user)),
  };
}

export async function getSession(userId, options = {}) {
  const user = await findUserById(userId);

  if (!user || (!options.allowInactive && user.status !== 'active')) {
    throw new AppError('Sessao invalida ou expirada', 401, 'session_unauthorized');
  }

  return buildResolvedSession(user);
}

export async function getAdminCompatibleSession(userId) {
  const user = await findUserById(userId);

  if (!user || user.status !== 'active') {
    throw new AppError('Sessao administrativa invalida ou expirada', 401, 'admin_unauthorized');
  }

  if (normalizeRoleLevel(user) > ROLE_LEVELS.INTERNAL_ADMIN) {
    throw new AppError('Sessao administrativa invalida ou expirada', 401, 'admin_unauthorized');
  }

  return user;
}
