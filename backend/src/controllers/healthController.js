import { successResponse } from '../utils/apiResponse.js';

export function getHealth(_req, res) {
  return successResponse(res, {
    status: 'ok',
    service: 'nfc-linktree-saas-api',
    timestamp: new Date().toISOString(),
  });
}

