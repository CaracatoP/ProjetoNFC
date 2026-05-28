import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './appError.js';
import { normalizeRoleLevel } from '../../../shared/utils/access.js';

const SESSION_TOKEN_ISSUERS = ['taplink-admin', 'nfc-linktree-saas'];

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
  const sessionProfile = buildSessionUserProfile(user);

  return {
    id: sessionProfile.id,
    email: sessionProfile.email,
    username: sessionProfile.username,
    displayName: sessionProfile.displayName,
    roles: sessionProfile.roles,
    role: sessionProfile.role,
    roleLevel: sessionProfile.roleLevel,
    businessId: sessionProfile.businessId,
    status: sessionProfile.status,
  };
}

export function buildSessionUserProfile(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return {
    id: String(user?._id || user?.id || ''),
    email: user?.email || '',
    username: user?.email || '',
    displayName: user?.name || 'Admin',
    roles,
    role: roles[0] || 'admin',
    roleLevel: normalizeRoleLevel(user),
    businessId: user?.businessId ? String(user.businessId) : '',
    status: user?.status || 'active',
  };
}

export function createSessionToken(user) {
  assertAdminJwtSecret();

  return jwt.sign(
    {
      sub: String(user._id),
      roles: user.roles || [],
      email: user.email,
      roleLevel: normalizeRoleLevel(user),
      businessId: user?.businessId ? String(user.businessId) : '',
    },
    env.adminTokenSecret,
    {
      issuer: 'taplink-admin',
      audience: 'admin-panel',
      expiresIn: `${env.adminSessionTtlHours}h`,
    },
  );
}

export function createAdminSessionToken(user) {
  return createSessionToken(user);
}

export function verifySessionToken(token) {
  assertAdminJwtSecret();

  try {
    return jwt.verify(String(token || ''), env.adminTokenSecret, {
      issuer: SESSION_TOKEN_ISSUERS,
      audience: 'admin-panel',
    });
  } catch (_error) {
    return null;
  }
}

export function verifyAdminSessionToken(token) {
  return verifySessionToken(token);
}
