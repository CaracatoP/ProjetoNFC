import { PLAN_TYPES, SUBSCRIPTION_STATUS } from '../../../shared/constants/index.js';
import { findPlanByCode, upsertPlanByCode, upsertSubscriptionByBusinessId } from '../repositories/billingRepository.js';

const DEFAULT_PLAN_DEFINITIONS = [
  {
    code: 'free',
    name: 'Free',
    type: PLAN_TYPES.FREE,
    priceCents: 0,
    currency: 'BRL',
    active: true,
    features: ['1 tenant', 'pagina publica por slug', 'painel admin interno'],
  },
  {
    code: 'starter',
    name: 'Starter',
    type: PLAN_TYPES.STARTER,
    priceCents: 4900,
    currency: 'BRL',
    active: true,
    features: ['tenant com branding completo', 'analytics basico', 'uploads de midia'],
  },
  {
    code: 'pro',
    name: 'Pro',
    type: PLAN_TYPES.PRO,
    priceCents: 9900,
    currency: 'BRL',
    active: true,
    features: ['multiplos fluxos', 'dominio customizado', 'recursos premium'],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    type: PLAN_TYPES.ENTERPRISE,
    priceCents: 0,
    currency: 'BRL',
    active: true,
    features: ['SLA', 'customizacoes avancadas', 'suporte dedicado'],
  },
];

export async function ensureDefaultPlans() {
  return Promise.all(DEFAULT_PLAN_DEFINITIONS.map((plan) => upsertPlanByCode(plan.code, plan)));
}

export async function ensureDefaultSubscriptionForBusiness(businessId) {
  let freePlan = await findPlanByCode('free');

  if (!freePlan) {
    const [createdFreePlan] = await ensureDefaultPlans();
    freePlan = createdFreePlan;
  }

  return upsertSubscriptionByBusinessId(businessId, {
    businessId,
    planId: freePlan._id,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    provider: 'internal',
    currentPeriodStart: new Date(),
    currentPeriodEnd: null,
  });
}
