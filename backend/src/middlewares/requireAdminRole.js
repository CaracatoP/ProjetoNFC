import { AppError } from '../utils/appError.js';

export function requireAdminRole(allowedRoles = []) {
  return (req, _res, next) => {
    const currentRoles = Array.isArray(req.adminUser?.roles) ? req.adminUser.roles : [];
    const hasRequiredRole = allowedRoles.some((role) => currentRoles.includes(role));

    if (!hasRequiredRole) {
      return next(new AppError('Voce nao tem permissao para acessar este recurso', 403, 'admin_forbidden'));
    }

    next();
  };
}
