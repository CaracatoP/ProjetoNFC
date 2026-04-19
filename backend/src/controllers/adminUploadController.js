import { AppError } from '../utils/appError.js';
import { successResponse } from '../utils/apiResponse.js';
import { uploadAdminImage } from '../services/adminUploadService.js';
import { adminUploadBodySchema } from '../validators/adminUploadValidators.js';

export async function uploadAdminImageController(req, res, next) {
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

    const result = await uploadAdminImage(req.file, {
      tenantSlug: parsedUploadBody.data.tenantSlug,
      assetType: parsedUploadBody.data.assetType,
    });
    return successResponse(res, result, undefined, 201);
  } catch (error) {
    return next(error);
  }
}
