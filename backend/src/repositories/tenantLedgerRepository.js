import { TenantLedgerEntry } from '../models/TenantLedgerEntry.js';

export function upsertTenantLedgerEntryByIdempotencyKey(idempotencyKey, payload) {
  return TenantLedgerEntry.findOneAndUpdate(
    { idempotencyKey },
    {
      $setOnInsert: {
        ...payload,
        idempotencyKey,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );
}

export function listTenantLedgerEntriesByBusinessId(
  businessId,
  { limit = 100, paymentId = null, orderId = null } = {},
) {
  const query = {
    businessId,
    ...(paymentId ? { paymentId } : {}),
    ...(orderId ? { orderId } : {}),
  };

  return TenantLedgerEntry.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 100, 500)));
}

export function aggregateTenantLedgerByBusinessId(businessId, pipeline = []) {
  return TenantLedgerEntry.aggregate([
    {
      $match: {
        businessId: TenantLedgerEntry.db.base.Types.ObjectId.isValid(String(businessId))
          ? new TenantLedgerEntry.db.base.Types.ObjectId(String(businessId))
          : businessId,
      },
    },
    ...pipeline,
  ]);
}

export function findTenantLedgerEntriesByPaymentId(paymentId) {
  return TenantLedgerEntry.find({ paymentId }).sort({ createdAt: 1, _id: 1 });
}

export function countTenantLedgerEntriesByIdempotencyKeys(idempotencyKeys = []) {
  return TenantLedgerEntry.countDocuments({ idempotencyKey: { $in: idempotencyKeys } });
}
