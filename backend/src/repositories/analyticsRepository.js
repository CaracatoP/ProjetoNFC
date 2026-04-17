import { AnalyticsEvent } from '../models/AnalyticsEvent.js';

export async function createAnalyticsEvent(payload) {
  return AnalyticsEvent.create(payload);
}

export async function countAnalyticsEventsByBusinessId(businessId) {
  return AnalyticsEvent.countDocuments({ businessId });
}

