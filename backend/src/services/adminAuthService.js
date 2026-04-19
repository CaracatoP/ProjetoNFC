import { ADMIN_USER_STATUS } from '../../../shared/constants/index.js';
import { findAdminUserByEmail, findAdminUserById, updateAdminUser } from '../repositories/userRepository.js';
import { buildAdminUserProfile, createAdminSessionToken } from '../utils/adminAuth.js';
import { AppError } from '../utils/appError.js';
import { verifyPassword } from '../utils/password.js';
import { ensureBootstrapAdminUser } from './systemBootstrapService.js';

function normalizeLoginIdentifier(credentials) {
  return String(credentials?.email || credentials?.username || '')
    .trim()
    .toLowerCase();
}

export async function loginAdmin(credentials) {
  await ensureBootstrapAdminUser();

  const identifier = normalizeLoginIdentifier(credentials);
  const user = await findAdminUserByEmail(identifier);
  const passwordMatches = await verifyPassword(credentials?.password, user?.passwordHash);

  if (!user || !passwordMatches) {
    throw new AppError('Credenciais administrativas invalidas', 401, 'admin_invalid_credentials');
  }

  if (user.status !== ADMIN_USER_STATUS.ACTIVE) {
    throw new AppError('Este usuario admin esta desativado', 403, 'admin_user_disabled');
  }

  await updateAdminUser(user._id, { lastLoginAt: new Date() });

  return {
    token: createAdminSessionToken(user),
    user: buildAdminUserProfile(user),
  };
}

export async function getAdminSession(userId) {
  const user = await findAdminUserById(userId);

  if (!user || user.status !== ADMIN_USER_STATUS.ACTIVE) {
    throw new AppError('Sessao administrativa invalida ou expirada', 401, 'admin_unauthorized');
  }

  return {
    user: buildAdminUserProfile(user),
  };
}
