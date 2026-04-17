import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { createAdminSessionToken, getAdminUserProfile } from '../utils/adminAuth.js';

export async function loginAdmin(credentials) {
  if (
    credentials.username !== env.adminUsername ||
    credentials.password !== env.adminPassword
  ) {
    throw new AppError('Credenciais administrativas inválidas', 401, 'admin_invalid_credentials');
  }

  return {
    token: createAdminSessionToken(),
    user: getAdminUserProfile(),
  };
}

export async function getAdminSession() {
  return {
    user: getAdminUserProfile(),
  };
}
