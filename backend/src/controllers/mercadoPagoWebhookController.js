import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';
import { PAYMENT_PROVIDERS } from '../../../shared/constants/index.js';
import { resolveBusinessPaymentSettings } from '../../../shared/utils/businessPayment.js';
import { findBusinessById } from '../repositories/businessRepository.js';
import { findOrderById } from '../repositories/orderRepository.js';
import { getMercadoPagoPayment, parseMercadoPagoExternalReference } from '../services/mercadoPagoService.js';
import { syncMercadoPagoOrderPaymentWebhook } from '../services/moduleService.js';
import { decryptSecret } from '../utils/secretCrypto.js';
import { AppError } from '../utils/appError.js';

function getStringValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }

  return String(value || '').trim();
}

function validateWebhookScope(business, order, businessId, orderId) {
  if (!business) {
    throw new AppError('Tenant nao encontrado', 404, 'business_not_found');
  }

  if (!order || String(order._id) !== String(orderId) || String(order.businessId) !== String(businessId)) {
    throw new AppError('Pedido nao encontrado para este tenant', 404, 'module_resource_not_found');
  }

  if (order.payment?.provider !== PAYMENT_PROVIDERS.MERCADO_PAGO) {
    throw new AppError('Pedido nao configurado para Mercado Pago', 404, 'module_resource_not_found');
  }
}

function validateExternalReferenceScope(externalReference, businessId, orderId) {
  const parsedReference = parseMercadoPagoExternalReference(externalReference);

  if (
    !parsedReference ||
    String(parsedReference.businessId) !== String(businessId) ||
    String(parsedReference.orderId) !== String(orderId)
  ) {
    throw new AppError('Este pagamento pertence a outro tenant ou pedido.', 404, 'module_resource_not_found');
  }
}

export async function mercadoPagoWebhookController(req, res, next) {
  try {
    const businessId = getStringValue(req.query.businessId);
    const orderId = getStringValue(req.query.orderId);
    const providerPaymentId =
      getStringValue(req.query['data.id']) || getStringValue(req.body?.data?.id);

    if (!businessId || !orderId || !providerPaymentId) {
      throw new AppError('Webhook Mercado Pago incompleto.', 400, 'mercado_pago_webhook_invalid');
    }

    const [business, order] = await Promise.all([
      findBusinessById(businessId),
      findOrderById(orderId),
    ]);

    validateWebhookScope(business, order, businessId, orderId);

    const paymentSettings = resolveBusinessPaymentSettings(business, { mode: 'storage' });
    const webhookSecret = decryptSecret(paymentSettings?.mercadoPago?.webhookSecretEncrypted || '');

    if (webhookSecret) {
      try {
        WebhookSignatureValidator.validate({
          xSignature: req.headers['x-signature'],
          xRequestId: req.headers['x-request-id'],
          dataId: req.query['data.id'],
          secret: webhookSecret,
          toleranceSeconds: 900,
        });
      } catch (error) {
        if (error instanceof InvalidWebhookSignatureError || error instanceof Error) {
          throw new AppError(
            'Assinatura do webhook Mercado Pago invalida.',
            401,
            'mercado_pago_webhook_invalid_signature',
          );
        }

        throw error;
      }
    }

    const paymentSnapshot = await getMercadoPagoPayment({
      providerPaymentId,
      mercadoPagoSettings: paymentSettings.mercadoPago,
    });

    validateExternalReferenceScope(paymentSnapshot.externalReference, businessId, orderId);

    if (
      order.payment?.providerPreferenceId &&
      paymentSnapshot.providerPreferenceId &&
      String(order.payment.providerPreferenceId) !== String(paymentSnapshot.providerPreferenceId)
    ) {
      throw new AppError('Este pagamento pertence a outro tenant ou pedido.', 404, 'module_resource_not_found');
    }

    await syncMercadoPagoOrderPaymentWebhook(businessId, orderId, paymentSnapshot, new Date());

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
