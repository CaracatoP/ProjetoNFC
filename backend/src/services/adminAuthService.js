import { buildAdminUserProfile, createAdminSessionToken } from '../utils/adminAuth.js';
import { ROLE_LEVELS } from '../../../shared/constants/access.js';
import { authenticateSessionUser, getAdminCompatibleSession } from './sessionAuthService.js';

export async function loginAdmin(credentials) {
  const user = await authenticateSessionUser(credentials, {
    allowedRoleLevels: [ROLE_LEVELS.SUPER_ADMIN, ROLE_LEVELS.INTERNAL_ADMIN],
    invalidCredentialsMessage: 'Credenciais administrativas invalidas',
    invalidCredentialsCode: 'admin_invalid_credentials',
    disabledMessage: 'Este usuario admin esta desativado',
    disabledCode: 'admin_user_disabled',
    forbiddenMessage: 'Este usuario nao pode acessar o painel admin',
    forbiddenCode: 'admin_forbidden',
  });

  return {
    token: createAdminSessionToken(user),
    user: buildAdminUserProfile(user),
  };
}

export async function getAdminSession(userId) {
  const user = await getAdminCompatibleSession(userId);

  return {
    user: buildAdminUserProfile(user),
  };
}
