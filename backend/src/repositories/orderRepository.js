import { Order } from '../models/Order.js';

export function listOrdersByBusinessId(businessId) {
  return Order.find({ businessId }).sort({ createdAt: -1 }).lean();
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
  return Order.findOneAndUpdate({ _id: id, businessId }, payload, { new: true, runValidators: true });
}
