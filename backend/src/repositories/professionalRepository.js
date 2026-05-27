import { Professional } from '../models/Professional.js';

export function listProfessionalsByBusinessId(businessId, options = {}) {
  const filter = { businessId };

  if (options.activeOnly) {
    filter.active = true;
  }

  return Professional.find(filter).sort({ active: -1, createdAt: 1 }).lean();
}

export function createProfessionalRecord(payload) {
  return Professional.create(payload);
}

export function findProfessionalById(id) {
  return Professional.findById(id);
}

export function updateProfessionalRecord(id, payload) {
  return Professional.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export function updateProfessionalRecordByBusinessId(businessId, id, payload) {
  return Professional.findOneAndUpdate({ _id: id, businessId }, payload, { new: true, runValidators: true });
}

export function deleteProfessionalRecord(id) {
  return Professional.findByIdAndDelete(id);
}

export function deleteProfessionalRecordByBusinessId(businessId, id) {
  return Professional.findOneAndDelete({ _id: id, businessId });
}
