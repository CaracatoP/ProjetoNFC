import { createAnalyticsEvent } from '../repositories/analyticsRepository.js';
import { buildVisitorHash } from '../utils/analytics.js';
import { assertBusinessExists } from './publicSiteService.js';

export async function trackAnalyticsEvent(input, requestContext) {
  const businessId = await assertBusinessExists(input);

  const event = await createAnalyticsEvent({
    businessId,
    eventType: input.eventType,
    sectionType: input.sectionType,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    metadata: input.metadata || {},
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    visitorHash: buildVisitorHash(requestContext),
    userAgent: requestContext.userAgent,
    ipAddress: requestContext.ipAddress,
  });

  return {
    recorded: true,
    eventId: event._id.toString(),
    businessId,
  };
}

