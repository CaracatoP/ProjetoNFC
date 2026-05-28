import {
  canAccessBusiness,
  canAssignRoleLevel,
  canAccessClientPanel,
  canPerformCriticalMutation,
  resolveBillingAccessState,
} from '../../../shared/utils/access.js';
import { BILLING_ACCESS_STATES } from '../../../shared/constants/access.js';
import { AppError } from './appError.js';

function resolveTargetBusinessId(businessIdOrContext) {
  if (typeof businessIdOrContext === 'string') {
    return businessIdOrContext;
  }

  return (
    businessIdOrContext?.businessId ||
    businessIdOrContext?.business?.id ||
    businessIdOrContext?.business?._id ||
    ''
  );
}

export function assertCanAccessBusiness(user, businessIdOrContext) {
  const businessId = resolveTargetBusinessId(businessIdOrContext);

  if (!canAccessBusiness(user, businessId)) {
    throw new AppError('Voce nao tem acesso a este tenant', 403, 'access_business_forbidden');
  }
}

export function assertCanAssignRoleLevel(user, desiredRoleLevel, options = {}) {
  if (!canAssignRoleLevel(user, desiredRoleLevel, options)) {
    throw new AppError('Voce nao pode atribuir este nivel de acesso', 403, 'access_role_level_forbidden');
  }
}

export function assertBillingAllowsPanelAccess(user, businessContext = {}) {
  if (!canAccessClientPanel(user, businessContext)) {
    throw new AppError('Seu acesso a este painel esta suspenso. Entre em contato com o suporte.', 423, 'client_access_suspended');
  }
}

export function assertBillingAllowsCriticalMutation(user, businessContext = {}) {
  assertBillingAllowsPanelAccess(user, businessContext);

  if (!canPerformCriticalMutation(user, businessContext)) {
    const billingState = resolveBillingAccessState(businessContext);

    if (billingState === BILLING_ACCESS_STATES.OVERDUE) {
      throw new AppError(
        'Seu pagamento esta vencido. Atualize a assinatura para liberar novamente as acoes criticas.',
        403,
        'client_billing_restricted',
      );
    }

    throw new AppError('Esta acao nao esta disponivel para o seu acesso atual.', 403, 'client_action_forbidden');
  }
}
