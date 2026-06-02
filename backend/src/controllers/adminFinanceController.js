import { canManageBilling } from '../../../shared/utils/access.js';
import {
  createAdminBusinessAsaasSubaccount,
  getAdminBusinessFinanceSettings,
  getAdminFinanceSettings,
  updateAdminBusinessFinanceSettings,
  updateAdminFinanceSettings,
} from '../services/adminFinanceService.js';
import { successResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';

function assertFinanceAccess(adminUser) {
  if (!canManageBilling(adminUser)) {
    throw new AppError('Apenas o nivel 0 pode acessar configuracoes financeiras.', 403, 'finance_forbidden');
  }
}

export async function getAdminFinanceSettingsController(req, res, next) {
  try {
    assertFinanceAccess(req.adminUser);
    return successResponse(res, await getAdminFinanceSettings());
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminFinanceSettingsController(req, res, next) {
  try {
    assertFinanceAccess(req.adminUser);
    return successResponse(res, await updateAdminFinanceSettings(req.body || {}));
  } catch (error) {
    return next(error);
  }
}

export async function getAdminBusinessFinanceSettingsController(req, res, next) {
  try {
    assertFinanceAccess(req.adminUser);
    const businessId = req.validated?.params?.businessId || req.params.businessId;
    return successResponse(res, await getAdminBusinessFinanceSettings(businessId));
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminBusinessFinanceSettingsController(req, res, next) {
  try {
    assertFinanceAccess(req.adminUser);
    const businessId = req.validated?.params?.businessId || req.params.businessId;
    return successResponse(
      res,
      await updateAdminBusinessFinanceSettings(businessId, req.validated?.body || req.body || {}),
    );
  } catch (error) {
    return next(error);
  }
}

export async function createAdminBusinessAsaasSubaccountController(req, res, next) {
  try {
    assertFinanceAccess(req.adminUser);
    const businessId = req.validated?.params?.businessId || req.params.businessId;
    return successResponse(
      res,
      await createAdminBusinessAsaasSubaccount(businessId, req.validated?.body || req.body || {}),
      undefined,
      201,
    );
  } catch (error) {
    return next(error);
  }
}
