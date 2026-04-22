import { successResponse } from '../utils/apiResponse.js';

export function getHealth(_req, res) {
  return successResponse(res, {
    status: 'ok',
    service: 'taplink-api',
    timestamp: new Date().toISOString(),
  });
}
