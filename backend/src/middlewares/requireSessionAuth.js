import { findUserById } from '../repositories/userRepository.js';
import { verifySessionToken, buildSessionUserProfile } from '../utils/adminAuth.js';
import { AppError } from '../utils/appError.js';

export async function requireSessionAuth(req, _res, next) {
  try {
    const authorizationHeader = req.headers.authorization || '';
    const token = authorizationHeader.startsWith('Bearer ') ? authorizationHeader.slice(7).trim() : '';
    const payload = verifySessionToken(token);

    if (!payload?.sub) {
      return next(new AppError('Sessao invalida ou expirada', 401, 'session_unauthorized'));
    }

    const user = await findUserById(payload.sub);

    if (!user || user.status !== 'active') {
      return next(new AppError('Sessao invalida ou expirada', 401, 'session_unauthorized'));
    }

    req.sessionUser = buildSessionUserProfile(user);
    next();
  } catch (error) {
    next(error);
  }
}
