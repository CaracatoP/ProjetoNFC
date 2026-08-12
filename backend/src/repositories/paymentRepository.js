import { Payment } from '../models/Payment.js';

function normalizePaymentPayload(payload = {}) {
  return {
    ...payload,
    amount: Number(Number(payload.amount || 0).toFixed(2)),
    platformFeeAmount: Number(Number(payload.platformFeeAmount || 0).toFixed(2)),
    tenantNetAmount: Number(Number(payload.tenantNetAmount || 0).toFixed(2)),
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
