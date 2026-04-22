import { AnalyticsEvent } from '../models/AnalyticsEvent.js';

export async function createAnalyticsEvent(payload) {
  return AnalyticsEvent.create(payload);
}
