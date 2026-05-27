import { AppointmentService } from '../models/AppointmentService.js';

export function listAppointmentServicesByBusinessId(businessId, options = {}) {
  const filter = { businessId };

  if (options.activeOnly) {
    filter.active = true;
  }

  return AppointmentService.find(filter).sort({ active: -1, createdAt: 1 }).lean();
}

export function createAppointmentServiceRecord(payload) {
  return AppointmentService.create(payload);
}

export function findAppointmentServiceById(id) {
  return AppointmentService.findById(id);
}

export function updateAppointmentServiceRecord(id, payload) {
  return AppointmentService.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export function updateAppointmentServiceRecordByBusinessId(businessId, id, payload) {
  return AppointmentService.findOneAndUpdate({ _id: id, businessId }, payload, { new: true, runValidators: true });
}

export function deleteAppointmentServiceRecord(id) {
  return AppointmentService.findByIdAndDelete(id);
}

export function deleteAppointmentServiceRecordByBusinessId(businessId, id) {
  return AppointmentService.findOneAndDelete({ _id: id, businessId });
}
