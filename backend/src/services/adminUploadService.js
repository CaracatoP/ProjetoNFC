import { buildTenantAssetFolder, uploadImageBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import { AppError } from '../utils/appError.js';
import { isAllowedAdminUploadAssetType, normalizeUploadAssetType } from '../utils/uploadPolicy.js';

export async function uploadAdminImage(file, options = {}) {
  const assetType = normalizeUploadAssetType(options.assetType);

  if (assetType && !isAllowedAdminUploadAssetType(assetType)) {
    throw new AppError('Tipo de upload nao permitido.', 400, 'admin_upload_asset_type_invalid');
  }

  const folder = buildTenantAssetFolder(options.tenantSlug);
  const result = await uploadImageBufferToCloudinary(file, {
    folder,
    assetType,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    folder,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    format: result.format,
  };
}
