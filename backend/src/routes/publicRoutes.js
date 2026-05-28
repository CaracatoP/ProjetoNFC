import { Router } from 'express';
import { createEvent } from '../controllers/analyticsController.js';
import {
  createPublicAppointmentRequestController,
  createPublicOrderController,
  listPublicProductsController,
} from '../controllers/moduleController.js';
import {
  publicAnalyticsRateLimiter,
  publicAppointmentRequestRateLimiter,
  publicOrderRateLimiter,
} from '../middlewares/rateLimit.js';
import { getSiteByHost, getSiteBySlug, resolveTag, streamTenantUpdates } from '../controllers/publicSiteController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { analyticsValidators } from '../validators/analyticsValidators.js';
import {
  appointmentRequestBodySchema,
  orderBodySchema,
  slugOnlyParamsSchema,
} from '../validators/moduleValidators.js';
import { publicSiteValidators } from '../validators/publicSiteValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/site',
  validateRequest(publicSiteValidators.siteByHost),
  asyncHandler(getSiteByHost),
);
router.get(
  '/realtime/tenant',
  validateRequest(publicSiteValidators.realtimeSubscription),
  streamTenantUpdates,
);
router.get(
  '/site/:slug',
  validateRequest(publicSiteValidators.siteBySlug),
  asyncHandler(getSiteBySlug),
);
router.get(
  '/site/:slug/products',
  validateRequest({ params: slugOnlyParamsSchema }),
  asyncHandler(listPublicProductsController),
);
router.post(
  '/site/:slug/appointment-requests',
  publicAppointmentRequestRateLimiter,
  validateRequest({ params: slugOnlyParamsSchema, body: appointmentRequestBodySchema }),
  asyncHandler(createPublicAppointmentRequestController),
);
router.post(
  '/site/:slug/orders',
  publicOrderRateLimiter,
  validateRequest({ params: slugOnlyParamsSchema, body: orderBodySchema }),
  asyncHandler(createPublicOrderController),
);
router.get(
  '/tags/:tagCode/resolve',
  validateRequest(publicSiteValidators.tagResolution),
  asyncHandler(resolveTag),
);
router.post(
  '/analytics/events',
  publicAnalyticsRateLimiter,
  validateRequest(analyticsValidators.createEvent),
  asyncHandler(createEvent),
);

export default router;
