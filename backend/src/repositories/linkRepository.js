import { BusinessLink } from '../models/BusinessLink.js';

export async function listVisibleLinksByBusinessId(businessId) {
  return BusinessLink.find({ businessId, visible: true }).sort({ order: 1, createdAt: 1 }).lean();
}

