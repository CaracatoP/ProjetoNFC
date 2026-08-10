import { AppointmentRequest } from '../models/AppointmentRequest.js';

export function listAppointmentRequestsByBusinessId(businessId) {
  return AppointmentRequest.find({ businessId }).sort({ createdAt: -1 }).lean();
}

export function countAppointmentRequestsByBusinessId(businessId) {
  return AppointmentRequest.countDocuments({ businessId });
}

export function countAppointmentRequestsByBusinessIdAndStatus(businessId, status) {
  return AppointmentRequest.countDocuments({ businessId, status });
}

export function createAppointmentRequestRecord(payload) {
  return AppointmentRequest.create(payload);
}

export function findAppointmentRequestById(id) {
  return AppointmentRequest.findById(id);
}

export function updateAppointmentRequestRecord(id, payload) {
  return AppointmentRequest.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export function updateAppointmentRequestRecordByBusinessId(businessId, id, payload) {
  return AppointmentRequest.findOneAndUpdate({ _id: id, businessId }, payload, { new: true, runValidators: true });
}
