import { createAnalyticsEvent } from '../repositories/analyticsRepository.js';
import { Business } from '../models/Business.js';
import { buildVisitorHash } from '../utils/analytics.js';
import { assertBusinessExists } from './publicSiteService.js';
import { AppError } from '../utils/appError.js';
import { isPreviewTokenValidForBusiness } from '../utils/previewToken.js';

async function resolveBusinessForAnalytics(reference) {
  if (reference.businessId) {
    return Business.findById(reference.businessId, { _id: 1, slug: 1 }).lean();
  }

  return Business.findOne({ slug: reference.slug }, { _id: 1, slug: 1 }).lean();
}

export async function trackAnalyticsEvent(input, requestContext) {
  const businessId = await assertBusinessExists(input);
  
  if (input.preview && input.previewToken) {
    const business = await resolveBusinessForAnalytics({ ...input, businessId });

    if (!business) {
      throw new AppError('Negocio nao encontrado para analytics', 404, 'business_not_found');
    }

    if (isPreviewTokenValidForBusiness(input.previewToken, business)) {
      return {
        recorded: false,
        ignoredReason: 'authorized_preview',
        businessId: String(business._id),
      };
    }
  }

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
