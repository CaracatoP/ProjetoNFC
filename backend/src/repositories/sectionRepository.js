import { BusinessSection } from '../models/BusinessSection.js';

export async function listVisibleSectionsByBusinessId(businessId) {
  return BusinessSection.find({ businessId, visible: true }).sort({ order: 1, createdAt: 1 }).lean();
}

