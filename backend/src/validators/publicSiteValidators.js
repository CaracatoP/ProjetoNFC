import { slugParamsSchema, tagParamsSchema } from '../../../shared/schemas/index.js';

export const publicSiteValidators = {
  siteBySlug: {
    params: slugParamsSchema,
  },
  tagResolution: {
    params: tagParamsSchema,
  },
};

