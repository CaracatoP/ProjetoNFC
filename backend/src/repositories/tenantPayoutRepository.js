import { TenantPayout } from '../models/TenantPayout.js';

export function listTenantPayoutsByBusinessId(businessId, { limit = 20 } = {}) {
  return TenantPayout.find({ businessId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 20, 200)));
}

export function createTenantPayoutRecord(payload = {}) {
  return TenantPayout.create(payload);
}
