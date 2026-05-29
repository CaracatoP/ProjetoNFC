import { AppError } from '../utils/appError.js';
import { successResponse } from '../utils/apiResponse.js';
import {
  createClientPanelAppointmentService,
  createClientPanelProduct,
  createClientPanelProfessional,
  deleteClientPanelOrder,
  deleteClientPanelAppointmentService,
  deleteClientPanelProduct,
  deleteClientPanelProfessional,
  getClientPanelAnalytics,
  getClientPanelBusiness,
  listClientPanelAppointmentRequests,
  listClientPanelAppointmentServices,
  listClientPanelOrders,
  listClientPanelProducts,
  listClientPanelProfessionals,
  updateClientPanelAppointmentRequestStatus,
  updateClientPanelAppointmentService,
  updateClientPanelBusinessBasics,
  updateClientPanelOrderStatus,
  updateClientPanelProduct,
  updateClientPanelProfessional,
  uploadClientPanelImage,
} from '../services/clientPanelService.js';
import { adminUploadBodySchema } from '../validators/adminUploadValidators.js';

function getParams(req) {
  return req.validated?.params || req.params || {};
}

function getBody(req) {
  return req.validated?.body || req.body || {};
}

export async function getClientPanelBusinessController(req, res, next) {
  try {
    return successResponse(res, await getClientPanelBusiness(req.sessionUser));
  } catch (error) {
    return next(error);
  }
}

export async function updateClientPanelBusinessBasicsController(req, res, next) {
  try {
    return successResponse(res, await updateClientPanelBusinessBasics(req.sessionUser, getBody(req)));
  } catch (error) {
    return next(error);
  }
}

export async function uploadClientPanelImageController(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('Nenhum arquivo enviado', 400, 'upload_missing_file');
    }

    const parsedUploadBody = adminUploadBodySchema.safeParse(req.body || {});

    if (!parsedUploadBody.success) {
      throw new AppError(
        'Falha de validacao',
        400,
        'validation_error',
        parsedUploadBody.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }

    return successResponse(
      res,
      await uploadClientPanelImage(req.sessionUser, req.file, {
        assetType: parsedUploadBody.data.assetType,
      }),
      undefined,
      201,
    );
  } catch (error) {
    return next(error);
  }
}

export async function listClientPanelProductsController(req, res, next) {
  try {
    return successResponse(res, await listClientPanelProducts(req.sessionUser));
  } catch (error) {
    return next(error);
  }
}

export async function createClientPanelProductController(req, res, next) {
  try {
    return successResponse(res, await createClientPanelProduct(req.sessionUser, getBody(req)), undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateClientPanelProductController(req, res, next) {
  try {
    return successResponse(res, await updateClientPanelProduct(req.sessionUser, getParams(req).id, getBody(req)));
  } catch (error) {
    return next(error);
  }
}

export async function deleteClientPanelProductController(req, res, next) {
  try {
    return successResponse(res, await deleteClientPanelProduct(req.sessionUser, getParams(req).id));
  } catch (error) {
    return next(error);
  }
}

export async function listClientPanelProfessionalsController(req, res, next) {
  try {
    return successResponse(res, await listClientPanelProfessionals(req.sessionUser));
  } catch (error) {
    return next(error);
  }
}

export async function createClientPanelProfessionalController(req, res, next) {
  try {
    return successResponse(res, await createClientPanelProfessional(req.sessionUser, getBody(req)), undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateClientPanelProfessionalController(req, res, next) {
  try {
    return successResponse(res, await updateClientPanelProfessional(req.sessionUser, getParams(req).id, getBody(req)));
  } catch (error) {
    return next(error);
  }
}

export async function deleteClientPanelProfessionalController(req, res, next) {
  try {
    return successResponse(res, await deleteClientPanelProfessional(req.sessionUser, getParams(req).id));
  } catch (error) {
    return next(error);
  }
}

export async function listClientPanelAppointmentServicesController(req, res, next) {
  try {
    return successResponse(res, await listClientPanelAppointmentServices(req.sessionUser));
  } catch (error) {
    return next(error);
  }
}

export async function createClientPanelAppointmentServiceController(req, res, next) {
  try {
    return successResponse(res, await createClientPanelAppointmentService(req.sessionUser, getBody(req)), undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateClientPanelAppointmentServiceController(req, res, next) {
  try {
    return successResponse(
      res,
      await updateClientPanelAppointmentService(req.sessionUser, getParams(req).id, getBody(req)),
    );
  } catch (error) {
    return next(error);
  }
}

export async function deleteClientPanelAppointmentServiceController(req, res, next) {
  try {
    return successResponse(res, await deleteClientPanelAppointmentService(req.sessionUser, getParams(req).id));
  } catch (error) {
    return next(error);
  }
}

export async function listClientPanelOrdersController(req, res, next) {
  try {
    return successResponse(res, await listClientPanelOrders(req.sessionUser));
  } catch (error) {
    return next(error);
  }
}

export async function updateClientPanelOrderStatusController(req, res, next) {
  try {
    return successResponse(
      res,
      await updateClientPanelOrderStatus(req.sessionUser, getParams(req).id, getBody(req).status),
    );
  } catch (error) {
    return next(error);
  }
}

export async function deleteClientPanelOrderController(req, res, next) {
  try {
    return successResponse(res, await deleteClientPanelOrder(req.sessionUser, getParams(req).id));
  } catch (error) {
    return next(error);
  }
}

export async function listClientPanelAppointmentRequestsController(req, res, next) {
  try {
    return successResponse(res, await listClientPanelAppointmentRequests(req.sessionUser));
  } catch (error) {
    return next(error);
  }
}

export async function updateClientPanelAppointmentRequestStatusController(req, res, next) {
  try {
    return successResponse(
      res,
      await updateClientPanelAppointmentRequestStatus(req.sessionUser, getParams(req).id, getBody(req).status),
    );
  } catch (error) {
    return next(error);
  }
}

export async function getClientPanelAnalyticsController(req, res, next) {
  try {
    return successResponse(res, await getClientPanelAnalytics(req.sessionUser));
  } catch (error) {
    return next(error);
  }
}
