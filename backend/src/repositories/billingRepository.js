import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';

export async function upsertPlanByCode(code, payload) {
  return Plan.findOneAndUpdate({ code }, payload, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  });
}

export async function findPlanByCode(code) {
  return Plan.findOne({ code });
}

export async function upsertSubscriptionByBusinessId(businessId, payload) {
  return Subscription.findOneAndUpdate({ businessId }, payload, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  });
}
