import { AppError } from '../utils/appError.js';
import { verifyAdminSessionToken } from '../utils/adminAuth.js';
import { findAdminUserById } from '../repositories/userRepository.js';

export async function requireAdminAuth(req, _res, next) {
  try {
    const authorizationHeader = req.headers.authorization || '';
    const token = authorizationHeader.startsWith('Bearer ') ? authorizationHeader.slice(7).trim() : '';
    const payload = verifyAdminSessionToken(token);

    if (!payload?.sub) {
      return next(new AppError('Sessao administrativa invalida ou expirada', 401, 'admin_unauthorized'));
    }

    const user = await findAdminUserById(payload.sub);

    if (!user || user.status !== 'active') {
      return next(new AppError('Sessao administrativa invalida ou expirada', 401, 'admin_unauthorized'));
    }

    req.adminUser = {
      id: String(user._id),
      email: user.email,
      roles: user.roles || [],
      role: user.roles?.[0] || 'admin',
      displayName: user.name,
      status: user.status,
    };

    next();
  } catch (error) {
    next(error);
  }
}
