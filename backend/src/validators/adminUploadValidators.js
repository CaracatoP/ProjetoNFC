import { z } from 'zod';
import { ADMIN_UPLOAD_ASSET_TYPES, normalizeUploadAssetType } from '../utils/uploadPolicy.js';

const optionalString = z.string().trim().optional().or(z.literal(''));
const uploadAssetTypeSchema = z.preprocess(
  (value) => normalizeUploadAssetType(value),
  z.union([z.literal(''), z.enum(ADMIN_UPLOAD_ASSET_TYPES)]),
);

export const adminUploadBodySchema = z.object({
  tenantSlug: optionalString,
  assetType: uploadAssetTypeSchema,
});
