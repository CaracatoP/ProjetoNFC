import { z } from 'zod';
import { slugParamsSchema, tagParamsSchema } from '../../../shared/schemas/index.js';

const hostPattern = /^(?!:\/\/)(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function normalizeHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

export const publicSiteValidators = {
  siteBySlug: {
    params: slugParamsSchema,
  },
  siteByHost: {
    query: z.object({
      host: z.preprocess(
        (value) => normalizeHost(value),
        z.string().regex(hostPattern, 'Informe um host valido para resolver o tenant'),
      ),
    }),
  },
  tagResolution: {
    params: tagParamsSchema,
  },
};
