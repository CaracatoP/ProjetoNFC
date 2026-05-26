import { BusinessLink } from '../models/BusinessLink.js';

const PUBLIC_LINK_PROJECTION = {
  type: 1,
  group: 1,
  label: 1,
  subtitle: 1,
  icon: 1,
  url: 1,
  value: 1,
  visible: 1,
  order: 1,
  target: 1,
  metadata: 1,
  createdAt: 1,
};

export async function listVisibleLinksByBusinessId(businessId) {
  return BusinessLink.find({ businessId, visible: true }).sort({ order: 1, createdAt: 1 }).lean();
}

export async function listPublicVisibleLinksByBusinessId(businessId) {
  return BusinessLink.find({ businessId, visible: true }, PUBLIC_LINK_PROJECTION)
    .sort({ order: 1, createdAt: 1 })
    .lean();
}
