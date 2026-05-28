export const PLAN_TYPES = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
};

export const PLAN_TYPE_VALUES = Object.values(PLAN_TYPES);

export const SUBSCRIPTION_STATUS = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  SUSPENDED: 'suspended',
  CANCELED: 'canceled',
};

export const SUBSCRIPTION_STATUS_VALUES = Object.values(SUBSCRIPTION_STATUS);

export const PLAN_CAPABILITY_DEFINITIONS = Object.freeze({
  [PLAN_TYPES.FREE]: {
    label: 'Free',
    analyticsScope: 'none',
    allowsBasicSettings: true,
    allowsOperationalSettings: true,
    allowsMediaUploads: true,
    maxProducts: null,
    maxProfessionals: null,
    maxOrders: null,
  },
  [PLAN_TYPES.STARTER]: {
    label: 'Starter',
    analyticsScope: 'none',
    allowsBasicSettings: true,
    allowsOperationalSettings: true,
    allowsMediaUploads: true,
    maxProducts: null,
    maxProfessionals: null,
    maxOrders: null,
  },
  [PLAN_TYPES.PRO]: {
    label: 'Pro',
    analyticsScope: 'basic',
    allowsBasicSettings: true,
    allowsOperationalSettings: true,
    allowsMediaUploads: true,
    maxProducts: null,
    maxProfessionals: null,
    maxOrders: null,
  },
  [PLAN_TYPES.PREMIUM]: {
    label: 'Premium',
    analyticsScope: 'advanced',
    allowsBasicSettings: true,
    allowsOperationalSettings: true,
    allowsMediaUploads: true,
    maxProducts: null,
    maxProfessionals: null,
    maxOrders: null,
  },
  [PLAN_TYPES.ENTERPRISE]: {
    label: 'Enterprise',
    analyticsScope: 'full',
    allowsBasicSettings: true,
    allowsOperationalSettings: true,
    allowsMediaUploads: true,
    maxProducts: null,
    maxProfessionals: null,
    maxOrders: null,
  },
});
