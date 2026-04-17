import { successResponse } from '../utils/apiResponse.js';
import { trackAnalyticsEvent } from '../services/analyticsService.js';

export async function createEvent(req, res) {
  const payload = await trackAnalyticsEvent(req.validated.body, {
    userAgent: req.headers['user-agent'] || '',
    ipAddress: req.ip,
  });

  return successResponse(res, payload, undefined, 201);
}

