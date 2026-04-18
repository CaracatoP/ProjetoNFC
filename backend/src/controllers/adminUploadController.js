import { AppError } from '../utils/appError.js';
import { successResponse } from '../utils/apiResponse.js';
import { uploadAdminImage } from '../services/adminUploadService.js';

function resolveRequestBaseUrl(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');

  if (forwardedHost) {
    return `${forwardedProto || req.protocol}://${forwardedHost}`;
  }

  return `${req.protocol}://${req.get('host')}`;
}

export async function uploadAdminImageController(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('Nenhum arquivo enviado', 400, 'upload_missing_file');
    }

    const result = await uploadAdminImage(req.file, resolveRequestBaseUrl(req));
    return successResponse(res, result, undefined, 201);
  } catch (error) {
    return next(error);
  }
}
