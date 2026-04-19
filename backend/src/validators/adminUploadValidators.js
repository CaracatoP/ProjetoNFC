import { z } from 'zod';

const optionalString = z.string().trim().optional().or(z.literal(''));

export const adminUploadBodySchema = z.object({
  tenantSlug: optionalString,
  assetType: optionalString,
});
