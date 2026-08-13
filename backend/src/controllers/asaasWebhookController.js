import { PAYMENT_PROVIDERS } from '../../../shared/constants/index.js';
import { resolveBusinessPaymentSettings } from '../../../shared/utils/businessPayment.js';
import { env } from '../config/env.js';
import { findBusinessById } from '../repositories/businessRepository.js';
import { findOrderById } from '../repositories/orderRepository.js';
import {
  markWebhookEventFailed,
  markWebhookEventProcessed,
  tryCreateWebhookEventRecord,
} from '../repositories/webhookEventRepository.js';
import { getAsaasPayment, parseAsaasExternalReference } from '../services/asaasService.js';
import { syncAsaasOrderPaymentWebhook } from '../services/moduleService.js';
import { getPlatformFinanceSettings, resolveAsaasProviderContext } from '../services/platformFinanceService.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

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
  let webhookEventRecord = null;

  try {
    validateAsaasWebhookAuthToken(getWebhookHeaderValue(req.headers['asaas-access-token']));

    const providerEventId = String(req.body?.id || '').trim();
    const providerEvent = String(req.body?.event || '').trim();
    const providerPaymentId = String(req.body?.payment?.id || '').trim();
    const incomingExternalReference = String(req.body?.payment?.externalReference || '').trim();

    if (!providerEventId || !providerEvent || !providerPaymentId || !incomingExternalReference) {
      throw new AppError('Webhook Asaas incompleto.', 400, 'asaas_webhook_invalid');
    }

    const webhookEventResult = await tryCreateWebhookEventRecord({
      provider: PAYMENT_PROVIDERS.ASAAS,
      eventId: providerEventId,
      eventType: providerEvent,
      providerResourceId: providerPaymentId,
      resourceType: 'payment',
      status: 'processing',
    });
    webhookEventRecord = webhookEventResult.record;

    if (!webhookEventResult.shouldProcess) {
      return res.status(204).end();
    }

    const parsedIncomingReference = parseAsaasExternalReference(incomingExternalReference);

    if (!parsedIncomingReference) {
      throw new AppError('Webhook Asaas invalido.', 400, 'asaas_webhook_invalid');
    }

    const { businessId, orderId } = parsedIncomingReference;
    logger.info(
      {
        provider: PAYMENT_PROVIDERS.ASAAS,
        providerEventId,
        providerEvent,
        providerPaymentId,
        businessId,
        orderId,
      },
      'Received Asaas webhook event',
    );
    const [business, order] = await Promise.all([
      findBusinessById(businessId),
      findOrderById(orderId),
    ]);

    validateWebhookOrderScope(business, order, businessId, orderId, providerPaymentId);

    const paymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
    const financeSettings = await getPlatformFinanceSettings();
    const asaasContext = resolveAsaasProviderContext({
      business,
      paymentSettings,
      financeSettings,
    });
    const providerPayment = await getAsaasPayment({
      apiKey: asaasContext.apiKey,
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

    await markWebhookEventProcessed(webhookEventRecord?._id, {
      businessId,
      resourceType: 'order_payment',
      resourceId: orderId,
      providerResourceId: providerPaymentId,
    });
    logger.info(
      {
        provider: PAYMENT_PROVIDERS.ASAAS,
        providerEventId,
        providerEvent,
        providerPaymentId,
        businessId,
        orderId,
      },
      'Processed Asaas webhook event',
    );

    return res.status(204).end();
  } catch (error) {
    logger.warn(
      {
        provider: PAYMENT_PROVIDERS.ASAAS,
        providerEventId: String(req.body?.id || '').trim(),
        providerEvent: String(req.body?.event || '').trim(),
        providerPaymentId: String(req.body?.payment?.id || '').trim(),
        code: error?.code,
        statusCode: error?.statusCode,
      },
      'Failed to process Asaas webhook event',
    );
    if (webhookEventRecord?._id) {
      await markWebhookEventFailed(webhookEventRecord._id, error).catch(() => {});
    }

    return next(error);
  }
}
