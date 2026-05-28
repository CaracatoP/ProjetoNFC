import { successResponse } from '../utils/apiResponse.js';
import { getSession, loginSession } from '../services/sessionAuthService.js';

export async function loginSessionController(req, res, next) {
  try {
    const credentials = req.validated?.body || req.body;
    const session = await loginSession(credentials);
    return successResponse(res, session);
  } catch (error) {
    return next(error);
  }
}

export async function getSessionController(req, res, next) {
  try {
    const session = await getSession(req.sessionUser?.id);
    return successResponse(res, session);
  } catch (error) {
    return next(error);
  }
}

export async function logoutSessionController(_req, res, next) {
  try {
    return successResponse(res, { loggedOut: true });
  } catch (error) {
    return next(error);
  }
}
