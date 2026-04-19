import { Router } from 'express';
import { createEvent } from '../controllers/analyticsController.js';
import { getSiteByHost, getSiteBySlug, resolveTag, streamTenantUpdates } from '../controllers/publicSiteController.js';
import { resolveTenant } from '../middlewares/resolveTenant.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { analyticsValidators } from '../validators/analyticsValidators.js';
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
  resolveTenant,
  validateRequest(publicSiteValidators.siteBySlug),
  asyncHandler(getSiteBySlug),
);
router.get(
  '/tags/:tagCode/resolve',
  validateRequest(publicSiteValidators.tagResolution),
  asyncHandler(resolveTag),
);
router.post(
  '/analytics/events',
  validateRequest(analyticsValidators.createEvent),
  asyncHandler(createEvent),
);

export default router;
