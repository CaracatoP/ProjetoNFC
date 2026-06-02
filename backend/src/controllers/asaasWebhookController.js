import { PAYMENT_PROVIDERS } from '../../../shared/constants/index.js';
import { resolveBusinessPaymentSettings } from '../../../shared/utils/businessPayment.js';
import { env } from '../config/env.js';
import { findBusinessById } from '../repositories/businessRepository.js';
import { findOrderById } from '../repositories/orderRepository.js';
import { getAsaasPayment, parseAsaasExternalReference } from '../services/asaasService.js';
import { syncAsaasOrderPaymentWebhook } from '../services/moduleService.js';
import { AppError } from '../utils/appError.js';

function getWebhookHeaderValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }

  return String(value || '').trim();
}

function validateAsaasWebhookAuthToken(requestToken) {
  const configuredToken = String(env.asaasWebhookAuthToken || '').trim();

  if (!configuredToken || requestToken !== configuredToken) {
    throw new AppError(
      'Webhook Asaas nao autorizado.',
      401,
      'asaas_webhook_unauthorized',
    );
  }
}

function validateWebhookOrderScope(business, order, businessId, orderId, providerPaymentId) {
  if (!business) {
    throw new AppError('Tenant nao encontrado', 404, 'business_not_found');
  }

  if (!order || String(order._id) !== String(orderId) || String(order.businessId) !== String(businessId)) {
    throw new AppError('Pedido nao encontrado para este tenant', 404, 'module_resource_not_found');
  }

  if (order.payment?.provider !== PAYMENT_PROVIDERS.ASAAS) {
    throw new AppError('Pedido nao configurado para Asaas', 404, 'module_resource_not_found');
  }

  if (
    providerPaymentId &&
    order.payment?.providerPaymentId &&
    String(order.payment.providerPaymentId) !== String(providerPaymentId)
  ) {
    throw new AppError('Este pagamento pertence a outro tenant ou pedido.', 404, 'module_resource_not_found');
  }
}

function validateProviderExternalReferenceScope(externalReference, businessId, orderId) {
  const parsedReference = parseAsaasExternalReference(externalReference);

  if (
    !parsedReference ||
    String(parsedReference.businessId) !== String(businessId) ||
    String(parsedReference.orderId) !== String(orderId)
  ) {
    throw new AppError('Este pagamento pertence a outro tenant ou pedido.', 404, 'module_resource_not_found');
  }
}

export async function asaasWebhookController(req, res, next) {
  try {
    validateAsaasWebhookAuthToken(getWebhookHeaderValue(req.headers['asaas-access-token']));

    const providerEvent = String(req.body?.event || '').trim();
    const providerPaymentId = String(req.body?.payment?.id || '').trim();
    const incomingExternalReference = String(req.body?.payment?.externalReference || '').trim();

    if (!providerEvent || !providerPaymentId || !incomingExternalReference) {
      throw new AppError('Webhook Asaas incompleto.', 400, 'asaas_webhook_invalid');
    }

    const parsedIncomingReference = parseAsaasExternalReference(incomingExternalReference);

    if (!parsedIncomingReference) {
      throw new AppError('Webhook Asaas invalido.', 400, 'asaas_webhook_invalid');
    }

    const { businessId, orderId } = parsedIncomingReference;
    const [business, order] = await Promise.all([
      findBusinessById(businessId),
      findOrderById(orderId),
    ]);

    validateWebhookOrderScope(business, order, businessId, orderId, providerPaymentId);

    const paymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
    const providerPayment = await getAsaasPayment({
      apiKey: paymentSettings?.asaas?.apiKeyEncrypted,
      paymentId: providerPaymentId,
    });

    validateProviderExternalReferenceScope(providerPayment.externalReference, businessId, orderId);

    await syncAsaasOrderPaymentWebhook(
      businessId,
      orderId,
      providerPayment,
      providerEvent,
      new Date(),
    );

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
