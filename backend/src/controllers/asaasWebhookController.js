import { PAYMENT_PROVIDERS, PAYMENT_STATUS } from '../../../shared/constants/index.js';
import { resolveBusinessPaymentSettings } from '../../../shared/utils/businessPayment.js';
import { env } from '../config/env.js';
import { findBusinessById } from '../repositories/businessRepository.js';
import { findOrderById } from '../repositories/orderRepository.js';
import {
  findPaymentByExternalReference,
  findPaymentByProviderPaymentId,
  updatePaymentByProviderPaymentId,
} from '../repositories/paymentRepository.js';
import {
  markWebhookEventFailed,
  markWebhookEventIgnored,
  markWebhookEventProcessed,
  tryCreateWebhookEventRecord,
} from '../repositories/webhookEventRepository.js';
import { getAsaasPayment, mapAsaasPaymentStatus, parseAsaasExternalReference } from '../services/asaasService.js';
import { syncAsaasOrderPaymentWebhook } from '../services/moduleService.js';
import { getPlatformFinanceSettings, resolveAsaasProviderContext } from '../services/platformFinanceService.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { isValidObjectId } from '../validators/objectId.js';

const PAYMENT_DELETED_EVENT = 'PAYMENT_DELETED';
const SUPPORTED_PAYMENT_EVENTS = new Set([
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_DELETED',
  'PAYMENT_OVERDUE',
]);

function normalizeAsaasEventType(value) {
  return String(value || '').trim().toUpperCase();
}

function isPaymentDeletedEvent(eventType) {
  return normalizeAsaasEventType(eventType) === PAYMENT_DELETED_EVENT;
}

function isPaymentEvent(eventType) {
  return normalizeAsaasEventType(eventType).startsWith('PAYMENT_');
}

function isSupportedPaymentEvent(eventType) {
  return SUPPORTED_PAYMENT_EVENTS.has(normalizeAsaasEventType(eventType));
}

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

function isExternalReferenceScopedToOrder(externalReference, businessId, orderId) {
  const parsedReference = parseAsaasExternalReference(externalReference);

  return Boolean(
    parsedReference &&
      String(parsedReference.businessId) === String(businessId) &&
      String(parsedReference.orderId) === String(orderId),
  );
}

function hasValidParsedReference(parsedReference) {
  return (
    parsedReference &&
    isValidObjectId(parsedReference.businessId) &&
    isValidObjectId(parsedReference.orderId)
  );
}

function resolveNonRegressiveWebhookPaymentStatus(currentStatus, incomingStatus) {
  if (currentStatus === PAYMENT_STATUS.PAID && incomingStatus !== PAYMENT_STATUS.PAID) {
    return currentStatus;
  }

  if (
    [PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED].includes(currentStatus) &&
    incomingStatus === PAYMENT_STATUS.PENDING
  ) {
    return currentStatus;
  }

  return incomingStatus;
}

function resolveWebhookPaymentStatus(currentStatus, asaasPayment = {}, providerEvent = '') {
  const incomingStatus = isPaymentDeletedEvent(providerEvent)
    ? PAYMENT_STATUS.CANCELLED
    : mapAsaasPaymentStatus(asaasPayment?.status);

  return resolveNonRegressiveWebhookPaymentStatus(currentStatus, incomingStatus);
}

function normalizeAsaasWebhookPaymentSnapshot({
  incomingPayment = {},
  providerPayment = null,
  providerPaymentId = '',
  externalReference = '',
  providerEvent = '',
} = {}) {
  const source = providerPayment || incomingPayment || {};

  return {
    ...source,
    id: String(source.id || providerPaymentId || '').trim(),
    status: isPaymentDeletedEvent(providerEvent)
      ? 'CANCELLED'
      : String(source.status || incomingPayment?.status || '').trim(),
    externalReference: String(source.externalReference || externalReference || '').trim(),
  };
}

function buildPaymentOnlyUpdatePayload(paymentRecord, asaasPayment = {}, providerEvent = '', occurredAt = new Date()) {
  const nextStatus = resolveWebhookPaymentStatus(paymentRecord.status, asaasPayment, providerEvent);
  const amount = Number(Number(asaasPayment?.value ?? paymentRecord.amount ?? 0).toFixed(2));
  const grossAmount = Number(Number(asaasPayment?.value ?? paymentRecord.grossAmount ?? amount).toFixed(2));

  return {
    method: paymentRecord.method,
    paymentArchitecture: paymentRecord.paymentArchitecture,
    billingType: String(asaasPayment?.billingType || paymentRecord.billingType || '').trim(),
    status: nextStatus,
    providerStatus: isPaymentDeletedEvent(providerEvent)
      ? 'DELETED'
      : String(asaasPayment?.status || paymentRecord.providerStatus || '').trim(),
    providerCustomerId: String(asaasPayment?.customer || paymentRecord.providerCustomerId || '').trim(),
    externalReference: String(asaasPayment?.externalReference || paymentRecord.externalReference || '').trim(),
    amount,
    grossAmount,
    platformFeeAmount: paymentRecord.platformFeeAmount || 0,
    tenantNetAmount: paymentRecord.tenantNetAmount || 0,
    refundedAmount: paymentRecord.refundedAmount || 0,
    invoiceUrl: String(asaasPayment?.invoiceUrl || paymentRecord.invoiceUrl || '').trim(),
    bankSlipUrl: String(asaasPayment?.bankSlipUrl || paymentRecord.bankSlipUrl || '').trim(),
    checkoutUrl: String(asaasPayment?.checkoutUrl || paymentRecord.checkoutUrl || '').trim(),
    pixCopyPaste: paymentRecord.pixCopyPaste || '',
    pixQrCode: paymentRecord.pixQrCode || '',
    pixQrCodeUrl: paymentRecord.pixQrCodeUrl || '',
    paidAt:
      nextStatus === PAYMENT_STATUS.PAID
        ? paymentRecord.paidAt ||
          asaasPayment?.confirmedDate ||
          asaasPayment?.clientPaymentDate ||
          occurredAt
        : paymentRecord.paidAt || null,
    confirmedAt:
      paymentRecord.confirmedAt ||
      asaasPayment?.confirmedDate ||
      asaasPayment?.clientPaymentDate ||
      null,
    receivedAt:
      paymentRecord.receivedAt ||
      asaasPayment?.creditDate ||
      asaasPayment?.clientPaymentDate ||
      asaasPayment?.paymentDate ||
      null,
    providerUpdatedAt: occurredAt,
  };
}

async function findLocalAsaasPayment({ providerPaymentId = '', externalReference = '' } = {}) {
  const normalizedProviderPaymentId = String(providerPaymentId || '').trim();
  const normalizedExternalReference = String(externalReference || '').trim();
  let paymentRecord = normalizedProviderPaymentId
    ? await findPaymentByProviderPaymentId(PAYMENT_PROVIDERS.ASAAS, normalizedProviderPaymentId)
    : null;

  if (!paymentRecord && normalizedExternalReference) {
    paymentRecord = await findPaymentByExternalReference(PAYMENT_PROVIDERS.ASAAS, normalizedExternalReference);
  }

  return paymentRecord;
}

function logWebhookResolution({
  providerEventId = '',
  providerEvent = '',
  providerPaymentId = '',
  externalReference = '',
  businessId = '',
  orderId = '',
  paymentFound = null,
  orderFound = null,
  resolution = '',
  reason = '',
} = {}) {
  logger.info(
    {
      provider: PAYMENT_PROVIDERS.ASAAS,
      eventId: providerEventId,
      eventType: providerEvent,
      providerPaymentId,
      externalReference: String(externalReference || '').trim(),
      businessId: String(businessId || ''),
      orderId: String(orderId || ''),
      ...(paymentFound === null ? {} : { paymentFound: Boolean(paymentFound) }),
      ...(orderFound === null ? {} : { orderFound: Boolean(orderFound) }),
      resolution,
      reason: String(reason || ''),
    },
    'webhook_event_received',
  );
}

export async function asaasWebhookController(req, res, next) {
  let webhookEventRecord = null;

  try {
    validateAsaasWebhookAuthToken(getWebhookHeaderValue(req.headers['asaas-access-token']));

    const providerEventId = String(req.body?.id || '').trim();
    const providerEvent = String(req.body?.event || '').trim();
    const providerPaymentId = String(req.body?.payment?.id || '').trim();
    const incomingExternalReference = String(req.body?.payment?.externalReference || '').trim();
    const incomingPayment = req.body?.payment || {};

    if (!providerEventId || !providerEvent || !providerPaymentId) {
      throw new AppError('Webhook Asaas incompleto.', 400, 'asaas_webhook_invalid');
    }

    if (!isPaymentEvent(providerEvent)) {
      const webhookEventResult = await tryCreateWebhookEventRecord({
        provider: PAYMENT_PROVIDERS.ASAAS,
        eventId: providerEventId,
        eventType: providerEvent,
        providerResourceId: providerPaymentId,
        resourceType: 'payment',
        status: 'processing',
      });
      webhookEventRecord = webhookEventResult.record;

      if (webhookEventResult.shouldProcess) {
        await markWebhookEventIgnored(webhookEventRecord?._id, {
          reason: 'unsupported_event',
          message: 'Evento Asaas sem acao local.',
          providerResourceId: providerPaymentId,
          resourceType: 'payment',
          metadata: {
            reason: 'unsupported_event',
            eventType: providerEvent,
          },
        });
      }

      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        resolution: webhookEventResult.shouldProcess ? 'ignored' : 'duplicate',
        reason: webhookEventResult.shouldProcess ? 'unsupported_event' : 'already_consumed',
      });

      return res.status(204).end();
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
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        resolution: 'duplicate',
        reason: 'already_consumed',
      });
      return res.status(204).end();
    }

    if (!isSupportedPaymentEvent(providerEvent)) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        reason: 'unsupported_payment_event',
        message: 'Evento de pagamento Asaas sem acao local configurada.',
        providerResourceId: providerPaymentId,
        resourceType: 'payment',
        metadata: {
          reason: 'unsupported_payment_event',
          eventType: providerEvent,
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        resolution: 'ignored',
        reason: 'unsupported_payment_event',
      });
      return res.status(204).end();
    }

    const parsedIncomingReference = parseAsaasExternalReference(incomingExternalReference);
    const localPayment = await findLocalAsaasPayment({
      providerPaymentId,
      externalReference: incomingExternalReference,
    });

    if (incomingExternalReference && !hasValidParsedReference(parsedIncomingReference) && !localPayment) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        reason: 'invalid_external_reference',
        message: 'Referencia externa invalida ou legada sem pagamento local.',
        providerResourceId: providerPaymentId,
        resourceType: 'payment',
        metadata: {
          reason: 'invalid_external_reference',
          eventType: providerEvent,
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        paymentFound: Boolean(localPayment),
        resolution: 'ignored',
        reason: 'invalid_external_reference',
      });
      return res.status(204).end();
    }

    if (!incomingExternalReference && !localPayment) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        reason: 'missing_external_reference',
        message: 'Evento sem referencia externa e sem pagamento local.',
        providerResourceId: providerPaymentId,
        resourceType: 'payment',
        metadata: {
          reason: 'missing_external_reference',
          eventType: providerEvent,
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        paymentFound: Boolean(localPayment),
        resolution: 'ignored',
        reason: 'missing_external_reference',
      });
      return res.status(204).end();
    }

    if (
      localPayment &&
      hasValidParsedReference(parsedIncomingReference) &&
      (
        String(localPayment.businessId || '') !== String(parsedIncomingReference.businessId) ||
        (
          localPayment.orderId &&
          String(localPayment.orderId || '') !== String(parsedIncomingReference.orderId)
        )
      )
    ) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        businessId: String(localPayment.businessId || ''),
        reason: 'local_payment_scope_mismatch',
        message: 'Evento Asaas aponta para tenant ou pedido diferente do pagamento local.',
        providerResourceId: providerPaymentId,
        resourceType: 'payment',
        resourceId: String(localPayment._id || ''),
        metadata: {
          reason: 'local_payment_scope_mismatch',
          eventType: providerEvent,
          incomingBusinessId: String(parsedIncomingReference.businessId || ''),
          incomingOrderId: String(parsedIncomingReference.orderId || ''),
          localBusinessId: String(localPayment.businessId || ''),
          localOrderId: String(localPayment.orderId || ''),
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        businessId: String(localPayment.businessId || ''),
        orderId: String(localPayment.orderId || ''),
        paymentFound: true,
        orderFound: null,
        resolution: 'ignored',
        reason: 'local_payment_scope_mismatch',
      });
      return res.status(204).end();
    }

    const businessId = hasValidParsedReference(parsedIncomingReference)
      ? parsedIncomingReference.businessId
      : String(localPayment?.businessId || '');
    const orderId = hasValidParsedReference(parsedIncomingReference)
      ? parsedIncomingReference.orderId
      : String(localPayment?.orderId || '');

    logger.info(
      {
        provider: PAYMENT_PROVIDERS.ASAAS,
        eventId: providerEventId,
        eventType: providerEvent,
        providerPaymentId,
        businessId,
        orderId,
      },
      'Received Asaas webhook event',
    );

    if (!isValidObjectId(businessId)) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        reason: 'invalid_business_id',
        message: 'Tenant da referencia externa e invalido.',
        providerResourceId: providerPaymentId,
        resourceType: 'payment',
        resourceId: orderId || '',
        metadata: {
          reason: 'invalid_business_id',
          eventType: providerEvent,
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        businessId,
        orderId,
        paymentFound: Boolean(localPayment),
        resolution: 'ignored',
        reason: 'invalid_business_id',
      });
      return res.status(204).end();
    }

    const business = await findBusinessById(businessId);

    if (!business) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        reason: 'business_not_found',
        message: 'Tenant local nao encontrado para evento Asaas.',
        providerResourceId: providerPaymentId,
        resourceType: 'payment',
        metadata: {
          reason: 'business_not_found',
          eventType: providerEvent,
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        businessId,
        orderId,
        paymentFound: Boolean(localPayment),
        resolution: 'ignored',
        reason: 'business_not_found',
      });
      return res.status(204).end();
    }

    const order = isValidObjectId(orderId) ? await findOrderById(orderId) : null;

    if (order && String(order.businessId) !== String(businessId)) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        businessId,
        reason: 'order_scope_mismatch',
        message: 'Evento Asaas aponta para pedido de outro tenant.',
        providerResourceId: providerPaymentId,
        resourceType: 'order_payment',
        resourceId: String(order._id || orderId),
        metadata: {
          reason: 'order_scope_mismatch',
          eventType: providerEvent,
          orderBusinessId: String(order.businessId || ''),
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        businessId,
        orderId,
        paymentFound: Boolean(localPayment),
        orderFound: true,
        resolution: 'ignored',
        reason: 'order_scope_mismatch',
      });
      return res.status(204).end();
    }

    if (!order && !localPayment) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        businessId,
        reason: 'payment_not_found',
        message: 'Pagamento local nao encontrado para evento Asaas.',
        providerResourceId: providerPaymentId,
        resourceType: 'payment',
        resourceId: orderId || '',
        metadata: {
          reason: 'payment_not_found',
          eventType: providerEvent,
          hasExternalReference: Boolean(incomingExternalReference),
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference,
        businessId,
        orderId,
        paymentFound: Boolean(localPayment),
        orderFound: Boolean(order),
        resolution: 'ignored',
        reason: 'payment_not_found',
      });
      return res.status(204).end();
    }

    const providerPayment = isPaymentDeletedEvent(providerEvent)
      ? normalizeAsaasWebhookPaymentSnapshot({
          incomingPayment,
          providerPaymentId,
          externalReference: incomingExternalReference || localPayment?.externalReference || '',
          providerEvent,
        })
      : await (async () => {
          const paymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
          const financeSettings = await getPlatformFinanceSettings();
          const asaasContext = resolveAsaasProviderContext({
            business,
            paymentSettings,
            financeSettings,
          });

          return getAsaasPayment({
            apiKey: asaasContext.apiKey,
            paymentId: providerPaymentId,
          });
        })();

    const providerExternalReference = String(providerPayment?.externalReference || '').trim();

    if (
      !isPaymentDeletedEvent(providerEvent) &&
      providerExternalReference &&
      !isExternalReferenceScopedToOrder(providerExternalReference, businessId, orderId)
    ) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        businessId,
        reason: 'provider_scope_mismatch',
        message: 'Asaas retornou referencia externa divergente do pagamento local.',
        providerResourceId: providerPaymentId,
        resourceType: order ? 'order_payment' : 'payment',
        resourceId: String(order?._id || localPayment?._id || orderId || ''),
        metadata: {
          reason: 'provider_scope_mismatch',
          eventType: providerEvent,
          providerExternalReference,
          expectedBusinessId: String(businessId || ''),
          expectedOrderId: String(orderId || ''),
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: providerExternalReference,
        businessId,
        orderId,
        paymentFound: Boolean(localPayment),
        orderFound: Boolean(order),
        resolution: 'ignored',
        reason: 'provider_scope_mismatch',
      });
      return res.status(204).end();
    }

    if (!order) {
      const updatedPayment = await updatePaymentByProviderPaymentId(
        PAYMENT_PROVIDERS.ASAAS,
        providerPaymentId,
        buildPaymentOnlyUpdatePayload(localPayment, providerPayment, providerEvent, new Date()),
      );

      await markWebhookEventProcessed(webhookEventRecord?._id, {
        businessId,
        resourceType: 'payment',
        resourceId: String(localPayment?._id || ''),
        providerResourceId: providerPaymentId,
        metadata: {
          eventType: providerEvent,
          orderMissing: true,
          orderId: orderId || '',
          paymentStatus: updatedPayment?.status || '',
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference || providerExternalReference,
        businessId,
        orderId,
        paymentFound: true,
        orderFound: false,
        resolution: 'processed',
        reason: 'payment_reconciled_without_order',
      });
      return res.status(204).end();
    }

    if (order.payment?.provider !== PAYMENT_PROVIDERS.ASAAS) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        businessId,
        reason: 'order_not_configured_for_asaas',
        message: 'Pedido local nao esta configurado para Asaas.',
        providerResourceId: providerPaymentId,
        resourceType: 'order_payment',
        resourceId: String(order._id || orderId),
        metadata: {
          reason: 'order_not_configured_for_asaas',
          eventType: providerEvent,
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference || providerExternalReference,
        businessId,
        orderId,
        paymentFound: Boolean(localPayment),
        orderFound: true,
        resolution: 'ignored',
        reason: 'order_not_configured_for_asaas',
      });
      return res.status(204).end();
    }

    if (
      order.payment?.providerPaymentId &&
      String(order.payment.providerPaymentId) !== String(providerPaymentId)
    ) {
      await markWebhookEventIgnored(webhookEventRecord?._id, {
        businessId,
        reason: 'order_payment_mismatch',
        message: 'Evento Asaas pertence a uma cobranca diferente da cobranca atual do pedido.',
        providerResourceId: providerPaymentId,
        resourceType: 'order_payment',
        resourceId: String(order._id || orderId),
        metadata: {
          reason: 'order_payment_mismatch',
          eventType: providerEvent,
        },
      });
      logWebhookResolution({
        providerEventId,
        providerEvent,
        providerPaymentId,
        externalReference: incomingExternalReference || providerExternalReference,
        businessId,
        orderId,
        paymentFound: Boolean(localPayment),
        orderFound: true,
        resolution: 'ignored',
        reason: 'order_payment_mismatch',
      });
      return res.status(204).end();
    }

    const providerPaymentSnapshot = normalizeAsaasWebhookPaymentSnapshot({
      incomingPayment,
      providerPayment,
      providerPaymentId,
      externalReference: incomingExternalReference || providerExternalReference || localPayment?.externalReference || '',
      providerEvent,
    });

    await syncAsaasOrderPaymentWebhook(
      businessId,
      orderId,
      providerPaymentSnapshot,
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
        eventId: providerEventId,
        eventType: providerEvent,
        providerPaymentId,
        businessId,
        orderId,
        resolution: 'processed',
      },
      'Processed Asaas webhook event',
    );
    logWebhookResolution({
      providerEventId,
      providerEvent,
      providerPaymentId,
      externalReference: incomingExternalReference || providerExternalReference || localPayment?.externalReference || '',
      businessId,
      orderId,
      paymentFound: Boolean(localPayment),
      orderFound: true,
      resolution: 'processed',
    });

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
    logger.warn(
      {
        provider: PAYMENT_PROVIDERS.ASAAS,
        eventId: String(req.body?.id || '').trim(),
        eventType: String(req.body?.event || '').trim(),
        providerPaymentId: String(req.body?.payment?.id || '').trim(),
        resolution: 'failed',
        reason: String(error?.code || 'webhook_processing_failed').trim(),
      },
      'webhook_event_received',
    );
    if (webhookEventRecord?._id) {
      await markWebhookEventFailed(webhookEventRecord._id, error).catch(() => {});
    }

    return next(error);
  }
}
