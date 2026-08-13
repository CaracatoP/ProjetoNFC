export const PAYMENT_METHODS = Object.freeze({
  PIX: 'pix',
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  CASH_ON_PICKUP: 'cash_on_pickup',
  CASH_ON_DELIVERY: 'cash_on_delivery',
});

export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS);

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  MANUAL: 'manual',
});

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

export const PAYMENT_PROVIDERS = Object.freeze({
  MANUAL: 'manual',
  ASAAS: 'asaas',
  MERCADO_PAGO: 'mercado_pago',
  STRIPE: 'stripe',
  PAGARME: 'pagarme',
});

export const PAYMENT_PROVIDER_VALUES = Object.values(PAYMENT_PROVIDERS);

export const PAYMENT_ARCHITECTURES = Object.freeze({
  CENTRALIZED: 'centralized',
  SUBACCOUNT: 'subaccount',
});

export const PAYMENT_ARCHITECTURE_VALUES = Object.values(PAYMENT_ARCHITECTURES);

export const TENANT_LEDGER_ENTRY_TYPES = Object.freeze({
  SALE_GROSS: 'sale_gross',
  PLATFORM_FEE: 'platform_fee',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
  PAYOUT: 'payout',
  PAYOUT_REVERSAL: 'payout_reversal',
});

export const TENANT_LEDGER_ENTRY_TYPE_VALUES = Object.values(TENANT_LEDGER_ENTRY_TYPES);

export const TENANT_LEDGER_ENTRY_STATUSES = Object.freeze({
  PENDING: 'pending',
  AVAILABLE: 'available',
  PAID_OUT: 'paid_out',
  REVERSED: 'reversed',
});

export const TENANT_LEDGER_ENTRY_STATUS_VALUES = Object.values(TENANT_LEDGER_ENTRY_STATUSES);

export const TENANT_PAYOUT_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

export const TENANT_PAYOUT_STATUS_VALUES = Object.values(TENANT_PAYOUT_STATUSES);

export const PAYMENT_METHOD_LABELS = Object.freeze({
  [PAYMENT_METHODS.PIX]: 'Pix',
  [PAYMENT_METHODS.CREDIT_CARD]: 'Cartao de credito',
  [PAYMENT_METHODS.DEBIT_CARD]: 'Cartao de debito',
  [PAYMENT_METHODS.CASH_ON_PICKUP]: 'Pagamento na retirada',
  [PAYMENT_METHODS.CASH_ON_DELIVERY]: 'Pagamento na entrega',
});

export const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUS.PENDING]: 'Pendente',
  [PAYMENT_STATUS.PAID]: 'Pago',
  [PAYMENT_STATUS.FAILED]: 'Falhou',
  [PAYMENT_STATUS.CANCELLED]: 'Cancelado',
  [PAYMENT_STATUS.MANUAL]: 'Manual',
});

export const PAYMENT_PROVIDER_LABELS = Object.freeze({
  [PAYMENT_PROVIDERS.MANUAL]: 'Manual',
  [PAYMENT_PROVIDERS.ASAAS]: 'Asaas',
  [PAYMENT_PROVIDERS.MERCADO_PAGO]: 'Mercado Pago',
  [PAYMENT_PROVIDERS.STRIPE]: 'Stripe',
  [PAYMENT_PROVIDERS.PAGARME]: 'Pagar.me',
});

export const DEFAULT_PAYMENT_METHOD = PAYMENT_METHODS.CASH_ON_PICKUP;
export const DEFAULT_PAYMENT_PROVIDER = PAYMENT_PROVIDERS.MANUAL;
export const DEFAULT_PAYMENT_STATUS = PAYMENT_STATUS.MANUAL;
export const DEFAULT_PAYMENT_ARCHITECTURE = PAYMENT_ARCHITECTURES.CENTRALIZED;
