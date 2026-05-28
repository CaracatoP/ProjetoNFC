import { successResponse } from '../utils/apiResponse.js';
import {
  createAdminClient,
  getAdminClient,
  listAdminClients,
  resetAdminClientPassword,
  updateAdminClient,
  updateAdminClientAccessLevel,
  updateAdminClientBillingStatus,
  updateAdminClientPlan,
  updateAdminClientStatus,
} from '../services/adminClientService.js';

export async function listAdminClientsController(req, res, next) {
  try {
    const clients = await listAdminClients(req.adminUser, req.validated?.query || req.query);
    return successResponse(res, clients);
  } catch (error) {
    return next(error);
  }
}

export async function createAdminClientController(req, res, next) {
  try {
    const client = await createAdminClient(req.adminUser, req.validated?.body || req.body);
    return successResponse(res, client, undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function getAdminClientController(req, res, next) {
  try {
    const client = await getAdminClient(req.adminUser, req.validated?.params?.clientId || req.params.clientId);
    return successResponse(res, client);
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminClientController(req, res, next) {
  try {
    const client = await updateAdminClient(
      req.adminUser,
      req.validated?.params?.clientId || req.params.clientId,
      req.validated?.body || req.body,
    );
    return successResponse(res, client);
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminClientAccessLevelController(req, res, next) {
  try {
    const client = await updateAdminClientAccessLevel(
      req.adminUser,
      req.validated?.params?.clientId || req.params.clientId,
      req.validated?.body?.roleLevel ?? req.body?.roleLevel,
    );
    return successResponse(res, client);
  } catch (error) {
    return next(error);
  }
}

export async function resetAdminClientPasswordController(req, res, next) {
  try {
    const client = await resetAdminClientPassword(
      req.adminUser,
      req.validated?.params?.clientId || req.params.clientId,
      req.validated?.body?.password || req.body?.password,
    );
    return successResponse(res, client);
  } catch (error) {
    return next(error);
  }
}

export async function blockAdminClientController(req, res, next) {
  try {
    const client = await updateAdminClientStatus(req.adminUser, req.validated?.params?.clientId || req.params.clientId, false);
    return successResponse(res, client);
  } catch (error) {
    return next(error);
  }
}

export async function unblockAdminClientController(req, res, next) {
  try {
    const client = await updateAdminClientStatus(req.adminUser, req.validated?.params?.clientId || req.params.clientId, true);
    return successResponse(res, client);
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminClientPlanController(req, res, next) {
  try {
    const client = await updateAdminClientPlan(
      req.adminUser,
      req.validated?.params?.clientId || req.params.clientId,
      req.validated?.body?.planCode || req.body?.planCode,
    );
    return successResponse(res, client);
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminClientBillingStatusController(req, res, next) {
  try {
    const client = await updateAdminClientBillingStatus(
      req.adminUser,
      req.validated?.params?.clientId || req.params.clientId,
      req.validated?.body?.billingStatus || req.body?.billingStatus,
    );
    return successResponse(res, client);
  } catch (error) {
    return next(error);
  }
}
