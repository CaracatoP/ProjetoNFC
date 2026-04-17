import { successResponse } from '../utils/apiResponse.js';
import { getAdminDashboardOverview } from '../services/adminDashboardService.js';

export async function getAdminDashboardOverviewController(_req, res, next) {
  try {
    const overview = await getAdminDashboardOverview();
    return successResponse(res, overview);
  } catch (error) {
    return next(error);
  }
}
