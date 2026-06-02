import { PAYMENT_METHODS, PAYMENT_PROVIDERS } from '../../../shared/constants/index.js';

export function isOnlinePaymentMethod(method) {
  return [
    PAYMENT_METHODS.PIX,
    PAYMENT_METHODS.CREDIT_CARD,
    PAYMENT_METHODS.DEBIT_CARD,
  ].includes(method);
}

export function getDeclaredHostedCheckoutProvider(paymentSettings = {}) {
  if (
    paymentSettings?.enabled &&
    paymentSettings?.provider === PAYMENT_PROVIDERS.ASAAS &&
    paymentSettings?.asaas?.enabled
  ) {
    return PAYMENT_PROVIDERS.ASAAS;
  }

  if (
    paymentSettings?.enabled &&
    paymentSettings?.provider === PAYMENT_PROVIDERS.MERCADO_PAGO &&
    paymentSettings?.mercadoPago?.enabled
  ) {
    return PAYMENT_PROVIDERS.MERCADO_PAGO;
  }

  return null;
}

export function isMercadoPagoProviderConnected(paymentSettings = {}) {
  return Boolean(
    paymentSettings?.enabled &&
      paymentSettings?.provider === PAYMENT_PROVIDERS.MERCADO_PAGO &&
      paymentSettings?.mercadoPago?.enabled &&
      paymentSettings?.mercadoPago?.accessTokenEncrypted,
  );
}

export function isAsaasProviderConnected(paymentSettings = {}) {
  return Boolean(
    paymentSettings?.enabled &&
      paymentSettings?.provider === PAYMENT_PROVIDERS.ASAAS &&
      paymentSettings?.asaas?.enabled &&
      paymentSettings?.asaas?.apiKeyEncrypted &&
      paymentSettings?.asaas?.walletId,
  );
}
