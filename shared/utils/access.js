import { ADMIN_ROLES } from '../constants/admin.js';
import {
  ANALYTICS_SCOPES,
  BILLING_ACCESS_STATES,
  ROLE_LEVELS,
} from '../constants/access.js';
import { BUSINESS_MODULE_KEYS } from '../constants/segments.js';
import {
  PLAN_CAPABILITY_DEFINITIONS,
  PLAN_TYPES,
  SUBSCRIPTION_STATUS,
} from '../constants/plans.js';

const ANALYTICS_SCOPE_ORDER = Object.freeze([
  ANALYTICS_SCOPES.NONE,
  ANALYTICS_SCOPES.SUMMARY,
  ANALYTICS_SCOPES.BASIC,
  ANALYTICS_SCOPES.ADVANCED,
  ANALYTICS_SCOPES.FULL,
]);

const ROLE_LEVEL_ANALYTICS_CAPS = Object.freeze({
  [ROLE_LEVELS.SUPER_ADMIN]: ANALYTICS_SCOPES.FULL,
  [ROLE_LEVELS.INTERNAL_ADMIN]: ANALYTICS_SCOPES.FULL,
  [ROLE_LEVELS.CLIENT_OWNER]: ANALYTICS_SCOPES.FULL,
  [ROLE_LEVELS.MANAGER]: ANALYTICS_SCOPES.BASIC,
  [ROLE_LEVELS.OPERATOR]: ANALYTICS_SCOPES.SUMMARY,
  [ROLE_LEVELS.VIEWER]: ANALYTICS_SCOPES.NONE,
});

function toComparableId(value) {
  if (!value) {
    return '';
  }

  if (typeof value?.toHexString === 'function') {
    return value.toHexString();
  }

  if (typeof value?.toString === 'function' && value.toString !== Object.prototype.toString) {
    const asString = value.toString();

    if (asString && asString !== '[object Object]') {
      return asString;
    }
  }

  if (typeof value === 'object') {
    if (typeof value.id === 'string') {
      return String(value.id);
    }

    if (value._id) {
      return toComparableId(value._id);
    }
  }

  return String(value);
}

function hasLegacyRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function getPlanCode(input) {
  if (typeof input === 'string') {
    return input;
  }

  return String(
    input?.planCode ||
      input?.plan?.code ||
      input?.subscription?.planCode ||
      input?.subscription?.plan?.code ||
      PLAN_TYPES.FREE,
  ).trim();
}

function getRawBillingStatus(input) {
  if (typeof input === 'string') {
    return input;
  }

  return String(
    input?.billingStatus ||
      input?.subscriptionStatus ||
      input?.status ||
      input?.subscription?.status ||
      BILLING_ACCESS_STATES.PAID,
  )
    .trim()
    .toLowerCase();
}

function isBillingAccessBlockedForClient(user, businessContext) {
  const billingState = resolveBillingAccessState(businessContext);
  const roleLevel = normalizeRoleLevel(user);

  if (roleLevel <= ROLE_LEVELS.INTERNAL_ADMIN) {
    return false;
  }

  return billingState === BILLING_ACCESS_STATES.SUSPENDED || billingState === BILLING_ACCESS_STATES.CANCELLED;
}

function isCriticalMutationBlockedForClient(user, businessContext) {
  const billingState = resolveBillingAccessState(businessContext);
  const roleLevel = normalizeRoleLevel(user);

  if (roleLevel <= ROLE_LEVELS.INTERNAL_ADMIN) {
    return false;
  }

  return (
    billingState === BILLING_ACCESS_STATES.OVERDUE ||
    billingState === BILLING_ACCESS_STATES.SUSPENDED ||
    billingState === BILLING_ACCESS_STATES.CANCELLED
  );
}

function isModuleEnabled(businessContext, moduleKey) {
  return Boolean(normalizeBusinessModules(businessContext)[moduleKey]);
}

function canReachBusinessContext(user, businessContext) {
  const targetBusinessId =
    businessContext?.businessId || businessContext?.business?.id || businessContext?.business?._id || '';

  if (!targetBusinessId) {
    return true;
  }

  return canAccessBusiness(user, targetBusinessId);
}

function getRoleAnalyticsCap(roleLevel) {
  return ROLE_LEVEL_ANALYTICS_CAPS[roleLevel] || ANALYTICS_SCOPES.NONE;
}

function getScopeRank(scope) {
  const rank = ANALYTICS_SCOPE_ORDER.indexOf(scope);
  return rank === -1 ? 0 : rank;
}

function getLowerAnalyticsScope(firstScope, secondScope) {
  return getScopeRank(firstScope) <= getScopeRank(secondScope) ? firstScope : secondScope;
}

export function normalizeRoleLevel(user) {
  if (Number.isInteger(user?.roleLevel)) {
    return user.roleLevel;
  }

  if (hasLegacyRole(user, ADMIN_ROLES.SUPERADMIN)) {
    return ROLE_LEVELS.SUPER_ADMIN;
  }

  if (hasLegacyRole(user, ADMIN_ROLES.ADMIN)) {
    return ROLE_LEVELS.INTERNAL_ADMIN;
  }

  return ROLE_LEVELS.VIEWER;
}

export function normalizeBusinessId(value) {
  return toComparableId(value);
}

export function resolvePlanCapabilities(input) {
  const planCode = getPlanCode(input);
  return PLAN_CAPABILITY_DEFINITIONS[planCode] || PLAN_CAPABILITY_DEFINITIONS[PLAN_TYPES.FREE];
}

export function resolveBillingAccessState(input) {
  const rawStatus = getRawBillingStatus(input);

  if ([SUBSCRIPTION_STATUS.TRIALING, BILLING_ACCESS_STATES.TRIAL].includes(rawStatus)) {
    return BILLING_ACCESS_STATES.TRIAL;
  }

  if ([SUBSCRIPTION_STATUS.ACTIVE, BILLING_ACCESS_STATES.PAID].includes(rawStatus)) {
    return BILLING_ACCESS_STATES.PAID;
  }

  if ([SUBSCRIPTION_STATUS.PAST_DUE, BILLING_ACCESS_STATES.OVERDUE].includes(rawStatus)) {
    return BILLING_ACCESS_STATES.OVERDUE;
  }

  if ([SUBSCRIPTION_STATUS.SUSPENDED, BILLING_ACCESS_STATES.SUSPENDED].includes(rawStatus)) {
    return BILLING_ACCESS_STATES.SUSPENDED;
  }

  if ([SUBSCRIPTION_STATUS.CANCELED, BILLING_ACCESS_STATES.CANCELLED, 'cancelled'].includes(rawStatus)) {
    return BILLING_ACCESS_STATES.CANCELLED;
  }

  return BILLING_ACCESS_STATES.PAID;
}

export function normalizeBusinessModules(businessContext) {
  const source = businessContext?.modules || businessContext?.business?.modules || {};

  return {
    [BUSINESS_MODULE_KEYS.CATALOG]: Boolean(source.catalog),
    [BUSINESS_MODULE_KEYS.APPOINTMENTS]: Boolean(source.appointments),
    [BUSINESS_MODULE_KEYS.CART]: Boolean(source.cart),
    [BUSINESS_MODULE_KEYS.ORDERS]: Boolean(source.orders),
    [BUSINESS_MODULE_KEYS.LOYALTY]: Boolean(source.loyalty),
    [BUSINESS_MODULE_KEYS.WHATSAPP]: Boolean(source.whatsapp),
    [BUSINESS_MODULE_KEYS.ANALYTICS]: Boolean(source.analytics),
  };
}

export function canAccessBusiness(user, businessId) {
  const roleLevel = normalizeRoleLevel(user);

  if (roleLevel <= ROLE_LEVELS.INTERNAL_ADMIN) {
    return true;
  }

  const actorBusinessId = normalizeBusinessId(user?.businessId);
  const targetBusinessId = normalizeBusinessId(businessId);

  return Boolean(actorBusinessId && targetBusinessId && actorBusinessId === targetBusinessId);
}

export function canManageUsers(user) {
  return normalizeRoleLevel(user) <= ROLE_LEVELS.INTERNAL_ADMIN;
}

export function canManageBilling(user) {
  return normalizeRoleLevel(user) === ROLE_LEVELS.SUPER_ADMIN;
}

export function canViewOnly(user) {
  return normalizeRoleLevel(user) === ROLE_LEVELS.VIEWER;
}

export function canAssignRoleLevel(user, desiredRoleLevel, options = {}) {
  const actorRoleLevel = normalizeRoleLevel(user);
  const nextRoleLevel = Number(desiredRoleLevel);

  if (!Number.isInteger(nextRoleLevel)) {
    return false;
  }

  if (toComparableId(options.targetUserId) && toComparableId(options.targetUserId) === toComparableId(user?.id || user?._id)) {
    return false;
  }

  if (actorRoleLevel === ROLE_LEVELS.SUPER_ADMIN) {
    return nextRoleLevel >= ROLE_LEVELS.SUPER_ADMIN && nextRoleLevel <= ROLE_LEVELS.VIEWER;
  }

  if (actorRoleLevel === ROLE_LEVELS.INTERNAL_ADMIN) {
    return nextRoleLevel >= ROLE_LEVELS.CLIENT_OWNER && nextRoleLevel <= ROLE_LEVELS.VIEWER;
  }

  return false;
}

export function canManageUserRecord(user, targetUser) {
  if (!canManageUsers(user)) {
    return false;
  }

  const actorRoleLevel = normalizeRoleLevel(user);
  const targetRoleLevel = normalizeRoleLevel(targetUser);

  if (toComparableId(user?.id || user?._id) && toComparableId(user?.id || user?._id) === toComparableId(targetUser?.id || targetUser?._id)) {
    return actorRoleLevel === ROLE_LEVELS.SUPER_ADMIN;
  }

  if (actorRoleLevel === ROLE_LEVELS.SUPER_ADMIN) {
    return true;
  }

  if (actorRoleLevel === ROLE_LEVELS.INTERNAL_ADMIN) {
    return targetRoleLevel >= ROLE_LEVELS.CLIENT_OWNER && targetRoleLevel <= ROLE_LEVELS.VIEWER;
  }

  return false;
}

export function canAccessClientPanel(user, businessContext) {
  if (!canReachBusinessContext(user, businessContext)) {
    return false;
  }

  return !isBillingAccessBlockedForClient(user, businessContext);
}

export function canPerformCriticalMutation(user, businessContext) {
  if (!canReachBusinessContext(user, businessContext)) {
    return false;
  }

  return !isCriticalMutationBlockedForClient(user, businessContext);
}

export function canEditTenantBasics(user, businessContext) {
  const roleLevel = normalizeRoleLevel(user);

  if (!canReachBusinessContext(user, businessContext)) {
    return false;
  }

  if (roleLevel <= ROLE_LEVELS.INTERNAL_ADMIN) {
    return true;
  }

  if (roleLevel !== ROLE_LEVELS.CLIENT_OWNER || !canPerformCriticalMutation(user, businessContext)) {
    return false;
  }

  return Boolean(resolvePlanCapabilities(businessContext).allowsBasicSettings);
}

export function canEditOperationalSettings(user, businessContext) {
  const roleLevel = normalizeRoleLevel(user);

  if (!canReachBusinessContext(user, businessContext)) {
    return false;
  }

  if (roleLevel <= ROLE_LEVELS.INTERNAL_ADMIN) {
    return true;
  }

  if (![ROLE_LEVELS.CLIENT_OWNER, ROLE_LEVELS.MANAGER].includes(roleLevel) || !canPerformCriticalMutation(user, businessContext)) {
    return false;
  }

  return Boolean(resolvePlanCapabilities(businessContext).allowsOperationalSettings);
}

export function canEditTenantSensitiveSettings(user, businessContext) {
  if (!canReachBusinessContext(user, businessContext)) {
    return false;
  }

  return normalizeRoleLevel(user) <= ROLE_LEVELS.INTERNAL_ADMIN;
}

export function canManageOrders(user, businessContext) {
  const roleLevel = normalizeRoleLevel(user);

  if (!canAccessClientPanel(user, businessContext)) {
    return false;
  }

  if (roleLevel > ROLE_LEVELS.OPERATOR) {
    return false;
  }

  return isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.ORDERS);
}

export function canViewOrders(user, businessContext) {
  if (!canAccessClientPanel(user, businessContext)) {
    return false;
  }

  return isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.ORDERS);
}

export function canManageAppointments(user, businessContext) {
  const roleLevel = normalizeRoleLevel(user);

  if (!canAccessClientPanel(user, businessContext)) {
    return false;
  }

  if (roleLevel > ROLE_LEVELS.OPERATOR) {
    return false;
  }

  return isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.APPOINTMENTS);
}

export function canViewAppointments(user, businessContext) {
  if (!canAccessClientPanel(user, businessContext)) {
    return false;
  }

  return isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.APPOINTMENTS);
}

export function canEditCatalog(user, businessContext) {
  return canEditOperationalSettings(user, businessContext) && isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.CATALOG);
}

export function canViewCatalog(user, businessContext) {
  if (!canAccessClientPanel(user, businessContext)) {
    return false;
  }

  return isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.CATALOG);
}

export function canEditServices(user, businessContext) {
  return (
    canEditOperationalSettings(user, businessContext) && isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.APPOINTMENTS)
  );
}

export function canViewServices(user, businessContext) {
  const roleLevel = normalizeRoleLevel(user);

  if (!canAccessClientPanel(user, businessContext)) {
    return false;
  }

  if (roleLevel > ROLE_LEVELS.MANAGER) {
    return false;
  }

  return isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.APPOINTMENTS);
}

export function canEditProfessionals(user, businessContext) {
  return (
    canEditOperationalSettings(user, businessContext) && isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.APPOINTMENTS)
  );
}

export function canViewProfessionals(user, businessContext) {
  const roleLevel = normalizeRoleLevel(user);

  if (!canAccessClientPanel(user, businessContext)) {
    return false;
  }

  if (roleLevel > ROLE_LEVELS.MANAGER) {
    return false;
  }

  return isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.APPOINTMENTS);
}

export function canUploadMedia(user, businessContext) {
  const roleLevel = normalizeRoleLevel(user);

  if (!canReachBusinessContext(user, businessContext)) {
    return false;
  }

  if (roleLevel <= ROLE_LEVELS.INTERNAL_ADMIN) {
    return true;
  }

  if (![ROLE_LEVELS.CLIENT_OWNER, ROLE_LEVELS.MANAGER].includes(roleLevel)) {
    return false;
  }

  if (!canPerformCriticalMutation(user, businessContext)) {
    return false;
  }

  return Boolean(resolvePlanCapabilities(businessContext).allowsMediaUploads);
}

export function resolveAnalyticsScope(user, businessContext) {
  if (!canReachBusinessContext(user, businessContext)) {
    return ANALYTICS_SCOPES.NONE;
  }

  if (!isModuleEnabled(businessContext, BUSINESS_MODULE_KEYS.ANALYTICS) || isBillingAccessBlockedForClient(user, businessContext)) {
    return ANALYTICS_SCOPES.NONE;
  }

  const roleScope = getRoleAnalyticsCap(normalizeRoleLevel(user));
  const planScope = resolvePlanCapabilities(businessContext).analyticsScope || ANALYTICS_SCOPES.NONE;

  return getLowerAnalyticsScope(roleScope, planScope);
}

export function canViewAnalytics(user, businessContext) {
  return resolveAnalyticsScope(user, businessContext) !== ANALYTICS_SCOPES.NONE;
}
