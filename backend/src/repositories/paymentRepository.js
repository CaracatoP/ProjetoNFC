import { Payment } from '../models/Payment.js';

function normalizePaymentPayload(payload = {}) {
  const grossAmount = Number(payload.grossAmount ?? payload.amount ?? 0);
  const amount = Number(payload.amount ?? grossAmount);
  const refundedAmount = Number(payload.refundedAmount || 0);

  return {
    ...payload,
    amount: Number(amount.toFixed(2)),
    grossAmount: Number(grossAmount.toFixed(2)),
    platformFeeAmount: Number(Number(payload.platformFeeAmount || 0).toFixed(2)),
    tenantNetAmount: Number(Number(payload.tenantNetAmount || 0).toFixed(2)),
    refundedAmount: Number(refundedAmount.toFixed(2)),
  };
}

export function upsertPaymentByProviderPaymentId(provider, providerPaymentId, payload) {
  const {
    provider: _payloadProvider,
    providerPaymentId: _payloadProviderPaymentId,
    ...safePayload
  } = normalizePaymentPayload(payload);

  return Payment.findOneAndUpdate(
    {
      provider,
      providerPaymentId,
    },
    {
      $set: safePayload,
      $setOnInsert: {
        provider,
        providerPaymentId,
      },
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    },
  );
}

export function findPaymentByProviderPaymentId(provider, providerPaymentId) {
  return Payment.findOne({ provider, providerPaymentId });
}

export function findPaymentById(id) {
  return Payment.findById(id);
}

export function findPaymentByBusinessIdAndOrderId(businessId, orderId) {
  return Payment.findOne({ businessId, orderId });
}

export function findPaymentByExternalReference(provider, externalReference) {
  return Payment.findOne({ provider, externalReference });
}

export function updatePaymentByProviderPaymentId(provider, providerPaymentId, payload) {
  const {
    provider: _payloadProvider,
    providerPaymentId: _payloadProviderPaymentId,
    ...safePayload
  } = normalizePaymentPayload(payload);

  return Payment.findOneAndUpdate(
    {
      provider,
      providerPaymentId,
    },
    {
      $set: safePayload,
    },
    {
      new: true,
      runValidators: true,
    },
  );
}

export function listPaymentsByBusinessId(businessId, { limit = 100 } = {}) {
  return Payment.find({ businessId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 100, 500)));
}
