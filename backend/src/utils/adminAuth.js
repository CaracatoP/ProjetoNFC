import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './appError.js';

function assertAdminJwtSecret() {
  if (String(env.adminTokenSecret || '').trim()) {
    return;
  }

  throw new AppError(
    'ADMIN_TOKEN_SECRET ou JWT_SECRET precisa estar configurado para autenticar o painel admin',
    500,
    'admin_auth_secret_missing',
  );
}

export function buildAdminUserProfile(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return {
    id: String(user?._id || user?.id || ''),
    email: user?.email || '',
    username: user?.email || '',
    displayName: user?.name || 'Admin',
    roles,
    role: roles[0] || 'admin',
    status: user?.status || 'active',
  };
}

export function createAdminSessionToken(user) {
  assertAdminJwtSecret();

  return jwt.sign(
    {
      sub: String(user._id),
      roles: user.roles || [],
      email: user.email,
    },
    env.adminTokenSecret,
    {
      issuer: 'nfc-linktree-saas',
      audience: 'admin-panel',
      expiresIn: `${env.adminSessionTtlHours}h`,
    },
  );
}

export function verifyAdminSessionToken(token) {
  assertAdminJwtSecret();

  try {
    return jwt.verify(String(token || ''), env.adminTokenSecret, {
      issuer: 'nfc-linktree-saas',
      audience: 'admin-panel',
    });
  } catch (_error) {
    return null;
  }
}
