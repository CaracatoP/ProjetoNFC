import { AppError } from '../utils/appError.js';
import { ADMIN_ROLES } from '../../../shared/constants/admin.js';
import { ROLE_LEVELS } from '../../../shared/constants/access.js';
import { normalizeRoleLevel } from '../../../shared/utils/access.js';

function mapAllowedRolesToRoleLevels(allowedRoles = []) {
  const allowedLevels = new Set();

  if (allowedRoles.includes(ADMIN_ROLES.SUPERADMIN)) {
    allowedLevels.add(ROLE_LEVELS.SUPER_ADMIN);
  }

  if (allowedRoles.includes(ADMIN_ROLES.ADMIN)) {
    allowedLevels.add(ROLE_LEVELS.SUPER_ADMIN);
    allowedLevels.add(ROLE_LEVELS.INTERNAL_ADMIN);
  }

  return allowedLevels;
}

export function requireAdminRole(allowedRoles = []) {
  return (req, _res, next) => {
    const hasRequiredRole = mapAllowedRolesToRoleLevels(allowedRoles).has(
      normalizeRoleLevel(req.adminUser),
    );

    if (!hasRequiredRole) {
      return next(new AppError('Voce nao tem permissao para acessar este recurso', 403, 'admin_forbidden'));
    }

    next();
  };
}
