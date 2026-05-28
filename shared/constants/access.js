export const ROLE_LEVELS = Object.freeze({
  SUPER_ADMIN: 0,
  INTERNAL_ADMIN: 1,
  CLIENT_OWNER: 2,
  MANAGER: 3,
  OPERATOR: 4,
  VIEWER: 5,
});

export const ROLE_LEVEL_VALUES = Object.freeze(Object.values(ROLE_LEVELS));

export const ROLE_LEVEL_LABELS = Object.freeze({
  [ROLE_LEVELS.SUPER_ADMIN]: 'Nivel 0 Super Admin',
  [ROLE_LEVELS.INTERNAL_ADMIN]: 'Nivel 1 Admin Operacional',
  [ROLE_LEVELS.CLIENT_OWNER]: 'Nivel 2 Cliente Dono',
  [ROLE_LEVELS.MANAGER]: 'Nivel 3 Gerente',
  [ROLE_LEVELS.OPERATOR]: 'Nivel 4 Operador',
  [ROLE_LEVELS.VIEWER]: 'Nivel 5 Visualizador',
});

export const BILLING_ACCESS_STATES = Object.freeze({
  TRIAL: 'trial',
  PAID: 'paid',
  OVERDUE: 'overdue',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
});

export const BILLING_ACCESS_STATE_VALUES = Object.freeze(Object.values(BILLING_ACCESS_STATES));

export const BILLING_ACCESS_LABELS = Object.freeze({
  [BILLING_ACCESS_STATES.TRIAL]: 'Teste',
  [BILLING_ACCESS_STATES.PAID]: 'Pago',
  [BILLING_ACCESS_STATES.OVERDUE]: 'Vencido',
  [BILLING_ACCESS_STATES.SUSPENDED]: 'Suspenso',
  [BILLING_ACCESS_STATES.CANCELLED]: 'Cancelado',
});

export const ANALYTICS_SCOPES = Object.freeze({
  NONE: 'none',
  SUMMARY: 'summary',
  BASIC: 'basic',
  ADVANCED: 'advanced',
  FULL: 'full',
});

export const ANALYTICS_SCOPE_VALUES = Object.freeze(Object.values(ANALYTICS_SCOPES));

export const ANALYTICS_SCOPE_LABELS = Object.freeze({
  [ANALYTICS_SCOPES.NONE]: 'Sem analytics',
  [ANALYTICS_SCOPES.SUMMARY]: 'Resumo',
  [ANALYTICS_SCOPES.BASIC]: 'Basico',
  [ANALYTICS_SCOPES.ADVANCED]: 'Avancado',
  [ANALYTICS_SCOPES.FULL]: 'Completo',
});
