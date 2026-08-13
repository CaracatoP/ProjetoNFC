import { Order } from '../models/Order.js';

export function listOrdersByBusinessId(
  businessId,
  { includeArchived = false, limit = null } = {},
) {
  const query = includeArchived ? { businessId } : { businessId, archivedAt: null };
  const cursor = Order.find(query).sort({ createdAt: -1 });

  if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
    cursor.limit(Math.min(Number(limit), 500));
  }

  return cursor.lean();
}

export function countOrdersByBusinessId(businessId) {
  return Order.countDocuments({ businessId, archivedAt: null });
}

export function countOrdersByBusinessIdAndStatus(businessId, status) {
  return Order.countDocuments({ businessId, archivedAt: null, status });
}

export function createOrderRecord(payload) {
  return Order.create(payload);
}

export function findOrderById(id) {
  return Order.findById(id);
}

export function findOrderByBusinessIdAndCheckoutTokenHash(
  businessId,
  checkoutTokenHash,
  { includeArchived = false } = {},
) {
  const query = includeArchived
    ? { businessId, publicCheckoutTokenHash: checkoutTokenHash }
    : { businessId, publicCheckoutTokenHash: checkoutTokenHash, archivedAt: null };

  return Order.findOne(query);
}

export function updateOrderRecord(id, payload) {
  return Order.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export function updateOrderRecordByBusinessId(
  businessId,
  id,
  payload,
  { includeArchived = false } = {},
) {
  return Order.findOneAndUpdate(
    includeArchived ? { _id: id, businessId } : { _id: id, businessId, archivedAt: null },
    payload,
    { new: true, runValidators: true },
  );
}

export function archiveOrderRecordByBusinessId(businessId, id, archivedAt = new Date()) {
  return Order.findOneAndUpdate(
    { _id: id, businessId, archivedAt: null },
    { archivedAt },
    { new: true, runValidators: true },
  );
}
