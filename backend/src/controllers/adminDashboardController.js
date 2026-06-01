import { successResponse } from '../utils/apiResponse.js';
import { getAdminDashboardOverview, resetAdminDashboardAnalytics } from '../services/adminDashboardService.js';

export async function getAdminDashboardOverviewController(_req, res, next) {
  try {
    const overview = await getAdminDashboardOverview();
    return successResponse(res, overview);
  } catch (error) {
    return next(error);
  }
}

export async function resetAdminDashboardAnalyticsController(req, res, next) {
  try {
    const payload = await resetAdminDashboardAnalytics(req.adminUser);
    return successResponse(res, payload);
  } catch (error) {
    return next(error);
  }
}
