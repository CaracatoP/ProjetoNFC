import { successResponse } from '../utils/apiResponse.js';
import {
  createPublicAppointmentRequest,
  createPublicOrder,
  createTenantAppointmentService,
  createTenantProduct,
  createTenantProfessional,
  deleteTenantAppointmentService,
  deleteTenantProduct,
  deleteTenantProfessional,
  listPublicProductsBySlug,
  listTenantAppointmentRequests,
  listTenantAppointmentServices,
  listTenantOrders,
  listTenantProducts,
  listTenantProfessionals,
  updateTenantAppointmentRequestStatus,
  updateTenantAppointmentService,
  updateTenantOrderPaymentStatus,
  updateTenantOrderStatus,
  updateTenantProduct,
  updateTenantProfessional,
} from '../services/moduleService.js';

function getParams(req) {
  return req.validated?.params || req.params || {};
}

function getBody(req) {
  return req.validated?.body || req.body || {};
}

export async function listProfessionalsController(req, res, next) {
  try {
    return successResponse(res, await listTenantProfessionals(getParams(req).businessId));
  } catch (error) {
    return next(error);
  }
}

export async function createProfessionalController(req, res, next) {
  try {
    return successResponse(res, await createTenantProfessional(getParams(req).businessId, getBody(req)), undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateProfessionalController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await updateTenantProfessional(businessId, id, getBody(req)));
  } catch (error) {
    return next(error);
  }
}

export async function deleteProfessionalController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await deleteTenantProfessional(businessId, id));
  } catch (error) {
    return next(error);
  }
}

export async function listAppointmentServicesController(req, res, next) {
  try {
    return successResponse(res, await listTenantAppointmentServices(getParams(req).businessId));
  } catch (error) {
    return next(error);
  }
}

export async function createAppointmentServiceController(req, res, next) {
  try {
    return successResponse(res, await createTenantAppointmentService(getParams(req).businessId, getBody(req)), undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateAppointmentServiceController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await updateTenantAppointmentService(businessId, id, getBody(req)));
  } catch (error) {
    return next(error);
  }
}

export async function deleteAppointmentServiceController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await deleteTenantAppointmentService(businessId, id));
  } catch (error) {
    return next(error);
  }
}

export async function listProductsController(req, res, next) {
  try {
    return successResponse(res, await listTenantProducts(getParams(req).businessId));
  } catch (error) {
    return next(error);
  }
}

export async function createProductController(req, res, next) {
  try {
    return successResponse(res, await createTenantProduct(getParams(req).businessId, getBody(req)), undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateProductController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await updateTenantProduct(businessId, id, getBody(req)));
  } catch (error) {
    return next(error);
  }
}

export async function deleteProductController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await deleteTenantProduct(businessId, id));
  } catch (error) {
    return next(error);
  }
}

export async function listPublicProductsController(req, res, next) {
  try {
    return successResponse(res, await listPublicProductsBySlug(getParams(req).slug));
  } catch (error) {
    return next(error);
  }
}

export async function createPublicAppointmentRequestController(req, res, next) {
  try {
    return successResponse(res, await createPublicAppointmentRequest(getParams(req).slug, getBody(req)), undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function listAppointmentRequestsController(req, res, next) {
  try {
    return successResponse(res, await listTenantAppointmentRequests(getParams(req).businessId));
  } catch (error) {
    return next(error);
  }
}

export async function updateAppointmentRequestStatusController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await updateTenantAppointmentRequestStatus(businessId, id, getBody(req).status));
  } catch (error) {
    return next(error);
  }
}

export async function createPublicOrderController(req, res, next) {
  try {
    return successResponse(res, await createPublicOrder(getParams(req).slug, getBody(req)), undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function listOrdersController(req, res, next) {
  try {
    return successResponse(res, await listTenantOrders(getParams(req).businessId));
  } catch (error) {
    return next(error);
  }
}

export async function updateOrderStatusController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await updateTenantOrderStatus(businessId, id, getBody(req).status));
  } catch (error) {
    return next(error);
  }
}

export async function updateOrderPaymentStatusController(req, res, next) {
  try {
    const { businessId, id } = getParams(req);
    return successResponse(res, await updateTenantOrderPaymentStatus(businessId, id, getBody(req).status));
  } catch (error) {
    return next(error);
  }
}
