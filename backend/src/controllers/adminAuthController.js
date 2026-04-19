import { successResponse } from '../utils/apiResponse.js';
import { getAdminSession, loginAdmin } from '../services/adminAuthService.js';

export async function loginAdminController(req, res, next) {
  try {
    const credentials = req.validated?.body || req.body;
    const session = await loginAdmin(credentials);
    return successResponse(res, session);
  } catch (error) {
    return next(error);
  }
}

export async function getAdminSessionController(_req, res, next) {
  try {
    const session = await getAdminSession(_req.adminUser?.id);
    return successResponse(res, session);
  } catch (error) {
    return next(error);
  }
}

export async function logoutAdminController(_req, res, next) {
  try {
    return successResponse(res, { loggedOut: true });
  } catch (error) {
    return next(error);
  }
}
