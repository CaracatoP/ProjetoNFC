import { ADMIN_ROLES, ADMIN_USER_STATUS } from '../../../shared/constants/index.js';
import { env } from '../config/env.js';
import { countAdminUsers, createAdminUser, findAdminUserByEmail, updateAdminUser } from '../repositories/userRepository.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';
import { ensureDefaultPlans } from './billingService.js';

function normalizeBootstrapRole(role) {
  return role === ADMIN_ROLES.ADMIN ? ADMIN_ROLES.ADMIN : ADMIN_ROLES.SUPERADMIN;
}

function validateRuntimeConfiguration() {
  if (!env.isProduction) {
    return;
  }

  const missing = [];

  if (!String(env.adminTokenSecret || '').trim()) {
    missing.push('ADMIN_TOKEN_SECRET or JWT_SECRET');
  }

  if (!String(env.analyticsSalt || '').trim()) {
    missing.push('ANALYTICS_SALT');
  }

  if (!String(env.mongodbUri || '').trim()) {
    missing.push('MONGODB_URI');
  }

  if (!env.frontendOrigins.length) {
    missing.push('FRONTEND_ORIGIN');
  }

  if (!String(env.publicSiteBaseUrl || '').trim()) {
    missing.push('PUBLIC_SITE_BASE_URL');
  }

  if (!String(env.apiPublicBaseUrl || '').trim()) {
    missing.push('API_PUBLIC_BASE_URL');
  }

  if (!missing.length) {
    return;
  }

  throw new AppError(
    `Configuracao obrigatoria ausente para producao: ${missing.join(', ')}`,
    500,
    'runtime_config_missing',
  );
}

export async function ensureBootstrapAdminUser() {
  const email = String(env.adminBootstrapEmail || '').trim().toLowerCase();
  const password = String(env.adminBootstrapPassword || '');

  if (!email || !password) {
    return null;
  }

  const existingUser = await findAdminUserByEmail(email);

  if (!existingUser) {
    const passwordHash = await hashPassword(password);
    const user = await createAdminUser({
      name: env.adminBootstrapName,
      email,
      passwordHash,
      roles: [normalizeBootstrapRole(env.adminBootstrapRole)],
      status: ADMIN_USER_STATUS.ACTIVE,
    });

    logger.info({ email }, 'Bootstrap admin user created');
    return user;
  }

  const nextRoles = Array.from(
    new Set([...(existingUser.roles || []), normalizeBootstrapRole(env.adminBootstrapRole)]),
  );
  const updatePayload = {};

  if (!existingUser.passwordHash) {
    updatePayload.passwordHash = await hashPassword(password);
  }

  if (!existingUser.name && env.adminBootstrapName) {
    updatePayload.name = env.adminBootstrapName;
  }

  if (nextRoles.length !== (existingUser.roles || []).length) {
    updatePayload.roles = nextRoles;
  }

  if (!Object.keys(updatePayload).length) {
    return existingUser;
  }

  const updatedUser = await updateAdminUser(existingUser._id, updatePayload);
  logger.info({ email }, 'Bootstrap admin user updated');
  return updatedUser;
}

export async function bootstrapSystemData() {
  validateRuntimeConfiguration();

  if (env.bootstrapDefaultPlans) {
    await ensureDefaultPlans();
  }

  const bootstrapUser = await ensureBootstrapAdminUser();

  if (!bootstrapUser) {
    const existingAdminUsers = await countAdminUsers();

    if (!existingAdminUsers) {
      logger.warn(
        'No bootstrap admin credentials were provided and no admin users exist yet. The panel will remain inaccessible until an admin user is created.',
      );
    }
  }
}
