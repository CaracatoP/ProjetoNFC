import { AppError } from '../utils/appError.js';

export function notFound(_req, _res, next) {
  next(new AppError('Endpoint não encontrado', 404, 'route_not_found'));
}

