import { AppError } from '../utils/appError.js';
import { successResponse } from '../utils/apiResponse.js';
import { uploadAdminImage } from '../services/adminUploadService.js';

export async function uploadAdminImageController(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('Nenhum arquivo enviado', 400, 'upload_missing_file');
    }

    const result = await uploadAdminImage(req.file, {
      tenantSlug: req.body?.tenantSlug,
      assetType: req.body?.assetType,
    });
    return successResponse(res, result, undefined, 201);
  } catch (error) {
    return next(error);
  }
}
