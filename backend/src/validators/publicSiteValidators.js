import { z } from 'zod';
import { slugParamsSchema, tagParamsSchema } from '../../../shared/schemas/index.js';
import { normalizeHost } from '../../../shared/utils/tenantIdentity.js';

const hostPattern = /^(?!:\/\/)(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const optionalStringSchema = z.preprocess(
  (value) => String(value || '').trim(),
  z.string(),
);

const optionalHostSchema = z.preprocess(
  (value) => normalizeHost(value),
  z.string(),
);

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
  realtimeSubscription: {
    query: z
      .object({
        businessId: optionalStringSchema.optional(),
        slug: optionalStringSchema.optional(),
        host: optionalHostSchema.optional(),
      })
      .superRefine((value, context) => {
        if (!value.businessId && !value.slug && !value.host) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['slug'],
            message: 'Informe businessId, slug ou host para assinar atualizacoes do tenant',
          });
        }

        if (value.host && !hostPattern.test(value.host)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['host'],
            message: 'Informe um host valido para assinar atualizacoes do tenant',
          });
        }
      }),
  },
  tagResolution: {
    params: tagParamsSchema,
  },
};
