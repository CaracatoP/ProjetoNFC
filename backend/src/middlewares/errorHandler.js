import { AppError } from '../utils/appError.js';
import { errorResponse } from '../utils/apiResponse.js';

export function errorHandler(error, _req, res, _next) {
  const normalizedError =
    error?.code === 11000
      ? new AppError('Ja existe um registro com este identificador unico', 409, 'duplicate_record', error.keyValue)
      : error?.name === 'MulterError'
        ? new AppError('Falha no upload do arquivo', 400, 'upload_error', error.message)
        : error instanceof AppError
          ? error
          : new AppError(error.message || 'Erro interno do servidor', 500, 'internal_error');

  return errorResponse(res, normalizedError);
}
