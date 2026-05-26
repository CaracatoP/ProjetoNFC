import { BusinessSection } from '../models/BusinessSection.js';

const PUBLIC_SECTION_PROJECTION = {
  key: 1,
  type: 1,
  title: 1,
  description: 1,
  order: 1,
  visible: 1,
  variant: 1,
  settings: 1,
  items: 1,
  createdAt: 1,
};

export async function listVisibleSectionsByBusinessId(businessId) {
  return BusinessSection.find({ businessId, visible: true }).sort({ order: 1, createdAt: 1 }).lean();
}

export async function listPublicVisibleSectionsByBusinessId(businessId) {
  return BusinessSection.find({ businessId, visible: true }, PUBLIC_SECTION_PROJECTION)
    .sort({ order: 1, createdAt: 1 })
    .lean();
}
