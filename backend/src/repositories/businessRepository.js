import { Business } from '../models/Business.js';

export async function findPublicBusinessBySlug(slug) {
  return Business.findOne({ slug, status: 'active' }).lean();
}

export async function findBusinessBySlug(slug) {
  return Business.findOne({ slug }).lean();
}

export async function findBusinessById(id) {
  return Business.findById(id).lean();
}

