import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_SCOPES,
  BILLING_ACCESS_STATES,
  ROLE_LEVELS,
} from '../../../shared/constants/access.js';
import {
  canAccessBusiness,
  canEditCatalog,
  canEditOperationalSettings,
  canEditTenantSensitiveSettings,
  canManageOrders,
  canAssignRoleLevel,
  canUploadMedia,
  canViewCatalog,
  resolveAnalyticsScope,
  resolveBillingAccessState,
} from '../../../shared/utils/access.js';
import {
  assertBillingAllowsCriticalMutation,
  assertBillingAllowsPanelAccess,
  assertCanAccessBusiness,
  assertCanAssignRoleLevel,
} from './sessionAccess.js';

function createBusinessContext(overrides = {}) {
  return {
    businessId: 'business-1',
    billingStatus: BILLING_ACCESS_STATES.PAID,
    planCode: 'premium',
    modules: {
      analytics: true,
      appointments: true,
      catalog: true,
      orders: true,
      cart: true,
      loyalty: true,
      whatsapp: true,
    },
    ...overrides,
  };
}

function createUser(roleLevel, overrides = {}) {
  return {
    id: overrides.id || `user-${roleLevel}`,
    roleLevel,
    businessId: overrides.businessId || 'business-1',
    ...overrides,
  };
}

describe('shared access helpers', () => {
  it('maps subscription statuses to canonical billing access states', () => {
    expect(resolveBillingAccessState('trialing')).toBe(BILLING_ACCESS_STATES.TRIAL);
    expect(resolveBillingAccessState('active')).toBe(BILLING_ACCESS_STATES.PAID);
    expect(resolveBillingAccessState('past_due')).toBe(BILLING_ACCESS_STATES.OVERDUE);
    expect(resolveBillingAccessState('suspended')).toBe(BILLING_ACCESS_STATES.SUSPENDED);
    expect(resolveBillingAccessState('canceled')).toBe(BILLING_ACCESS_STATES.CANCELLED);
  });

  it('resolves analytics scope from plan, role level and active module', () => {
    const baseContext = createBusinessContext();

    expect(resolveAnalyticsScope(createUser(ROLE_LEVELS.CLIENT_OWNER), baseContext)).toBe(ANALYTICS_SCOPES.ADVANCED);
    expect(resolveAnalyticsScope(createUser(ROLE_LEVELS.MANAGER), baseContext)).toBe(ANALYTICS_SCOPES.BASIC);
    expect(resolveAnalyticsScope(createUser(ROLE_LEVELS.OPERATOR), baseContext)).toBe(ANALYTICS_SCOPES.SUMMARY);
    expect(resolveAnalyticsScope(createUser(ROLE_LEVELS.VIEWER), baseContext)).toBe(ANALYTICS_SCOPES.NONE);
    expect(resolveAnalyticsScope(createUser(ROLE_LEVELS.CLIENT_OWNER), { ...baseContext, planCode: 'starter' })).toBe(
      ANALYTICS_SCOPES.NONE,
    );
    expect(
      resolveAnalyticsScope(createUser(ROLE_LEVELS.CLIENT_OWNER), {
        ...baseContext,
        modules: { ...baseContext.modules, analytics: false },
      }),
    ).toBe(ANALYTICS_SCOPES.NONE);
  });

  it('keeps tenant access scoped to the linked business for client users', () => {
    expect(canAccessBusiness(createUser(ROLE_LEVELS.SUPER_ADMIN), 'another-business')).toBe(true);
    expect(canAccessBusiness(createUser(ROLE_LEVELS.INTERNAL_ADMIN), 'another-business')).toBe(true);
    expect(canAccessBusiness(createUser(ROLE_LEVELS.CLIENT_OWNER), 'business-1')).toBe(true);
    expect(canAccessBusiness(createUser(ROLE_LEVELS.CLIENT_OWNER), 'another-business')).toBe(false);
  });

  it('blocks critical catalog and operational edits when billing is overdue', () => {
    const overdueContext = createBusinessContext({ billingStatus: BILLING_ACCESS_STATES.OVERDUE });

    expect(canEditOperationalSettings(createUser(ROLE_LEVELS.CLIENT_OWNER), overdueContext)).toBe(false);
    expect(canEditCatalog(createUser(ROLE_LEVELS.CLIENT_OWNER), overdueContext)).toBe(false);
    expect(canUploadMedia(createUser(ROLE_LEVELS.CLIENT_OWNER), overdueContext)).toBe(false);
    expect(canManageOrders(createUser(ROLE_LEVELS.OPERATOR), overdueContext)).toBe(true);
  });

  it('allows catalog viewing for read-only tenant users while keeping uploads limited to elevated roles', () => {
    const context = createBusinessContext();

    expect(canViewCatalog(createUser(ROLE_LEVELS.VIEWER), context)).toBe(true);
    expect(canUploadMedia(createUser(ROLE_LEVELS.MANAGER), context)).toBe(true);
    expect(canUploadMedia(createUser(ROLE_LEVELS.OPERATOR), context)).toBe(false);
  });

  it('allows sensitive tenant settings only for internal levels', () => {
    const context = createBusinessContext();

    expect(canEditTenantSensitiveSettings(createUser(ROLE_LEVELS.SUPER_ADMIN), context)).toBe(true);
    expect(canEditTenantSensitiveSettings(createUser(ROLE_LEVELS.INTERNAL_ADMIN), context)).toBe(true);
    expect(canEditTenantSensitiveSettings(createUser(ROLE_LEVELS.CLIENT_OWNER), context)).toBe(false);
  });

  it('prevents privilege escalation through role assignment rules', () => {
    expect(canAssignRoleLevel(createUser(ROLE_LEVELS.SUPER_ADMIN), ROLE_LEVELS.INTERNAL_ADMIN)).toBe(true);
    expect(canAssignRoleLevel(createUser(ROLE_LEVELS.INTERNAL_ADMIN), ROLE_LEVELS.CLIENT_OWNER)).toBe(true);
    expect(canAssignRoleLevel(createUser(ROLE_LEVELS.INTERNAL_ADMIN), ROLE_LEVELS.INTERNAL_ADMIN)).toBe(false);
    expect(
      canAssignRoleLevel(createUser(ROLE_LEVELS.INTERNAL_ADMIN, { id: 'same-user' }), ROLE_LEVELS.CLIENT_OWNER, {
        targetUserId: 'same-user',
      }),
    ).toBe(false);
    expect(canAssignRoleLevel(createUser(ROLE_LEVELS.MANAGER), ROLE_LEVELS.VIEWER)).toBe(false);
  });
});

describe('backend session access guards', () => {
  it('throws when a client user tries to access another tenant by id', () => {
    expect(() => assertCanAccessBusiness(createUser(ROLE_LEVELS.CLIENT_OWNER), 'other-business')).toThrowError(
      /tenant/i,
    );
  });

  it('blocks panel access for suspended clients', () => {
    expect(() =>
      assertBillingAllowsPanelAccess(createUser(ROLE_LEVELS.CLIENT_OWNER), {
        billingStatus: BILLING_ACCESS_STATES.SUSPENDED,
      }),
    ).toThrowError(/suspenso/i);
  });

  it('blocks critical mutations for overdue clients', () => {
    expect(() =>
      assertBillingAllowsCriticalMutation(createUser(ROLE_LEVELS.CLIENT_OWNER), {
        billingStatus: BILLING_ACCESS_STATES.OVERDUE,
      }),
    ).toThrowError(/vencido/i);
  });

  it('throws when an internal admin tries to assign a forbidden role level', () => {
    expect(() =>
      assertCanAssignRoleLevel(createUser(ROLE_LEVELS.INTERNAL_ADMIN), ROLE_LEVELS.INTERNAL_ADMIN),
    ).toThrowError(/nivel de acesso/i);
  });
});
