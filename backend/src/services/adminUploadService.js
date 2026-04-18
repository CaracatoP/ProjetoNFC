import { buildTenantAssetFolder, uploadImageBufferToCloudinary } from '../utils/cloudinaryUpload.js';

export async function uploadAdminImage(file, options = {}) {
  const folder = buildTenantAssetFolder(options.tenantSlug);
  const result = await uploadImageBufferToCloudinary(file, {
    folder,
    assetType: options.assetType,
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
