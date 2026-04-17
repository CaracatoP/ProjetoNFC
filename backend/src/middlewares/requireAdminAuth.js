import { AppError } from '../utils/appError.js';
import { verifyAdminSessionToken } from '../utils/adminAuth.js';

export function requireAdminAuth(req, _res, next) {
  const authorizationHeader = req.headers.authorization || '';
  const token = authorizationHeader.startsWith('Bearer ') ? authorizationHeader.slice(7).trim() : '';
  const user = verifyAdminSessionToken(token);

  if (!user) {
    next(new AppError('Sessao administrativa invalida ou expirada', 401, 'admin_unauthorized'));
    return;
  }

  req.adminUser = user;
  next();
}
