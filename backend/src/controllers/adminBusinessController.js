import { successResponse } from '../utils/apiResponse.js';
import {
  createAdminBusiness,
  deleteAdminBusiness,
  getAdminBusinessEditor,
  listAdminBusinesses,
  updateAdminBusiness,
} from '../services/adminBusinessService.js';

export async function listAdminBusinessesController(_req, res, next) {
  try {
    const businesses = await listAdminBusinesses();
    return successResponse(res, businesses);
  } catch (error) {
    return next(error);
  }
}

export async function getAdminBusinessController(req, res, next) {
  try {
    const businessId = req.validated?.params?.businessId || req.params.businessId;
    const editor = await getAdminBusinessEditor(businessId);
    return successResponse(res, editor);
  } catch (error) {
    return next(error);
  }
}

export async function createAdminBusinessController(req, res, next) {
  try {
    const business = await createAdminBusiness(req.validated?.body || req.body);
    return successResponse(res, business, undefined, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminBusinessController(req, res, next) {
  try {
    const businessId = req.validated?.params?.businessId || req.params.businessId;
    const business = await updateAdminBusiness(businessId, req.validated?.body || req.body);
    return successResponse(res, business);
  } catch (error) {
    return next(error);
  }
}

export async function deleteAdminBusinessController(req, res, next) {
  try {
    const businessId = req.validated?.params?.businessId || req.params.businessId;
    const result = await deleteAdminBusiness(businessId);
    return successResponse(res, result);
  } catch (error) {
    return next(error);
  }
}
