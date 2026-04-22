import { env } from '../config/env.js';
import { errorResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, _next) {
  const normalizedError =
    error?.code === 11000
      ? error?.keyPattern?.slug
        ? new AppError('Este slug ja esta em uso por outro tenant', 409, 'business_slug_conflict', [
            { path: 'business.slug', message: 'Este slug ja esta em uso por outro tenant' },
          ])
        : error?.keyPattern?.['domains.subdomain']
          ? new AppError('Este subdominio ja esta em uso por outro tenant', 409, 'business_subdomain_conflict', [
              { path: 'business.domains.subdomain', message: 'Este subdominio ja esta em uso por outro tenant' },
            ])
          : error?.keyPattern?.['domains.customDomain']
            ? new AppError('Este dominio customizado ja esta em uso por outro tenant', 409, 'business_custom_domain_conflict', [
                { path: 'business.domains.customDomain', message: 'Este dominio customizado ja esta em uso por outro tenant' },
              ])
        : error?.keyPattern?.email
          ? new AppError('Ja existe um usuario admin com este e-mail', 409, 'admin_user_email_conflict', [
              { path: 'email', message: 'Ja existe um usuario admin com este e-mail' },
            ])
          : new AppError('Ja existe um registro com este identificador unico', 409, 'duplicate_record', error.keyValue)
      : error?.name === 'MulterError'
        ? new AppError('Falha no upload do arquivo', 400, 'upload_error', error.message)
        : error instanceof AppError
          ? error
          : new AppError(error.message || 'Erro interno do servidor', 500, 'internal_error');

  logger[normalizedError.statusCode >= 500 ? 'error' : 'warn'](
    {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: normalizedError.statusCode,
      code: normalizedError.code,
      details: normalizedError.details,
      err: error,
    },
    'Request failed',
  );

  if (env.isProduction && normalizedError.statusCode >= 500 && normalizedError.code === 'internal_error') {
    normalizedError.message = 'Erro interno do servidor';
    normalizedError.details = undefined;
  }

  return errorResponse(res, normalizedError);
}
