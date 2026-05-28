import { ADMIN_ROLES, ADMIN_USER_STATUS } from '../../../shared/constants/index.js';
import { env } from '../config/env.js';
import { countAdminUsers, createAdminUser, findAdminUserByEmail, updateAdminUser } from '../repositories/userRepository.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';
import { User } from '../models/User.js';
import { ensureDefaultPlans } from './billingService.js';

const SUPER_ADMIN_ROLE_LEVEL = 0;
const INTERNAL_ADMIN_ROLE_LEVEL = 1;

function buildMissingRoleLevelQuery() {
  return {
    $or: [{ roleLevel: { $exists: false } }, { roleLevel: null }],
  };
}

function normalizeBootstrapRole(role) {
  return role === ADMIN_ROLES.ADMIN ? ADMIN_ROLES.ADMIN : ADMIN_ROLES.SUPERADMIN;
}

function userHasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function isClearlyInternalLegacyUser(user) {
  return userHasRole(user, ADMIN_ROLES.ADMIN) || userHasRole(user, ADMIN_ROLES.SUPERADMIN);
}

function canPromoteExistingBootstrapUser(user) {
  return Boolean(user?.bootstrapManaged || user?.roleLevel === SUPER_ADMIN_ROLE_LEVEL || userHasRole(user, ADMIN_ROLES.SUPERADMIN));
}

export async function normalizeLegacyInternalUsers() {
  const missingRoleLevelQuery = buildMissingRoleLevelQuery();

  await User.updateMany(
    {
      ...missingRoleLevelQuery,
      roles: ADMIN_ROLES.SUPERADMIN,
    },
    {
      $set: {
        roleLevel: SUPER_ADMIN_ROLE_LEVEL,
      },
    },
  );

  await User.updateMany(
    {
      ...missingRoleLevelQuery,
      roles: ADMIN_ROLES.ADMIN,
      $nor: [{ roles: ADMIN_ROLES.SUPERADMIN }],
    },
    {
      $set: {
        roleLevel: INTERNAL_ADMIN_ROLE_LEVEL,
      },
    },
  );
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

  await normalizeLegacyInternalUsers();

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
      roleLevel: SUPER_ADMIN_ROLE_LEVEL,
      bootstrapManaged: true,
      status: ADMIN_USER_STATUS.ACTIVE,
    });

    logger.info({ email }, 'Bootstrap admin user created');
    return user;
  }

  if (!isClearlyInternalLegacyUser(existingUser) && !existingUser.bootstrapManaged) {
    logger.error(
      { email, userId: String(existingUser._id) },
      'Bootstrap admin email points to a non-internal user and cannot be promoted automatically',
    );
    throw new AppError(
      'O e-mail de bootstrap aponta para um usuario sem marcador interno. Corrija a configuracao antes de continuar.',
      500,
      'admin_bootstrap_conflict',
    );
  }

  if (!canPromoteExistingBootstrapUser(existingUser)) {
    logger.error(
      { email, userId: String(existingUser._id), roles: existingUser.roles || [], roleLevel: existingUser.roleLevel ?? null },
      'Bootstrap admin email points to an internal user that is not eligible for automatic level-0 promotion',
    );
    throw new AppError(
      'O e-mail de bootstrap aponta para um usuario interno que nao pode ser promovido automaticamente a nivel 0.',
      500,
      'admin_bootstrap_conflict',
    );
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

  if (existingUser.roleLevel !== SUPER_ADMIN_ROLE_LEVEL) {
    updatePayload.roleLevel = SUPER_ADMIN_ROLE_LEVEL;
  }

  if (!existingUser.bootstrapManaged) {
    updatePayload.bootstrapManaged = true;
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
