import { PAYMENT_METHODS } from '../../../shared/constants/index.js';
import { AppError } from './appError.js';

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function validatePaymentMethodForDeliveryType(deliveryType, paymentMethod) {
  const normalizedDeliveryType = normalizeValue(deliveryType);
  const normalizedPaymentMethod = normalizeValue(paymentMethod);

  if (!normalizedDeliveryType) {
    throw new AppError('Escolha se deseja entrega ou retirada.', 400, 'order_delivery_type_required');
  }

  if (!normalizedPaymentMethod) {
    throw new AppError('Escolha uma forma de pagamento.', 400, 'order_payment_method_required');
  }

  if (
    (normalizedDeliveryType === 'delivery' &&
      normalizedPaymentMethod === PAYMENT_METHODS.CASH_ON_PICKUP) ||
    (normalizedDeliveryType === 'pickup' &&
      normalizedPaymentMethod === PAYMENT_METHODS.CASH_ON_DELIVERY)
  ) {
    throw new AppError(
      'Essa forma de pagamento nao esta disponivel para o tipo de recebimento escolhido.',
      400,
      'order_payment_method_incompatible',
    );
  }

  return {
    deliveryType: normalizedDeliveryType,
    paymentMethod: normalizedPaymentMethod,
  };
}
