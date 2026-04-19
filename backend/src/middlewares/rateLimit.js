import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { errorResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';

function buildLimiter(windowMs, max, message, code) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler(_req, res) {
      return errorResponse(res, new AppError(message, 429, code));
    },
  });
}

export const adminLoginRateLimiter = buildLimiter(
  env.authLoginRateLimitWindowMs,
  env.authLoginRateLimitMax,
  'Muitas tentativas de login. Aguarde antes de tentar novamente.',
  'admin_login_rate_limited',
);

export const adminUploadRateLimiter = buildLimiter(
  env.uploadRateLimitWindowMs,
  env.uploadRateLimitMax,
  'Limite temporario de uploads atingido. Tente novamente em instantes.',
  'admin_upload_rate_limited',
);
