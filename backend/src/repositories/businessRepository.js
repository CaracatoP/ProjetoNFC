import { BUSINESS_STATUS } from '../../../shared/constants/index.js';
import { Business } from '../models/Business.js';

export async function findPublicBusinessBySlug(slug) {
  return Business.findOne({
    slug,
    status: {
      $in: [BUSINESS_STATUS.ACTIVE, BUSINESS_STATUS.DRAFT],
    },
  }).lean();
}

export async function findBusinessBySlug(slug) {
  return Business.findOne({ slug }).lean();
}

export async function findBusinessById(id) {
  return Business.findById(id).lean();
}
