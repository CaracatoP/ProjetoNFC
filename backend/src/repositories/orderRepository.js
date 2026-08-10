import { Order } from '../models/Order.js';

export function listOrdersByBusinessId(businessId) {
  return Order.find({ businessId, archivedAt: null }).sort({ createdAt: -1 }).lean();
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

export function updateOrderRecord(id, payload) {
  return Order.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export function updateOrderRecordByBusinessId(businessId, id, payload) {
  return Order.findOneAndUpdate({ _id: id, businessId, archivedAt: null }, payload, { new: true, runValidators: true });
}

export function archiveOrderRecordByBusinessId(businessId, id, archivedAt = new Date()) {
  return Order.findOneAndUpdate(
    { _id: id, businessId, archivedAt: null },
    { archivedAt },
    { new: true, runValidators: true },
  );
}
