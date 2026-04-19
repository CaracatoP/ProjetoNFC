import { z } from 'zod';
import { BUSINESS_STATUS_VALUES, LINK_GROUPS, LINK_TYPE_VALUES, SECTION_TYPE_VALUES } from '../../../shared/constants/index.js';

const optionalString = z.string().optional().or(z.literal(''));
const slugPattern = /^[a-z0-9-]+$/;

function slugify(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const optionalNumber = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().finite().optional());

const hoursSchema = z.array(
  z.object({
    id: optionalString,
    label: optionalString,
    value: optionalString,
  }),
);

const slugSchema = z.preprocess(
  (value) => slugify(value),
  z.string().min(2).regex(slugPattern, 'Informe um slug valido usando apenas letras, numeros e hifens'),
);

const businessBodySchema = z.object({
  name: z.string().min(2),
  legalName: optionalString,
  slug: slugSchema,
  description: optionalString,
  logoUrl: optionalString,
  logoPublicId: optionalString,
  bannerUrl: optionalString,
  bannerPublicId: optionalString,
  badge: optionalString,
  status: z.enum(BUSINESS_STATUS_VALUES),
  rating: optionalString,
  domains: z
    .object({
      subdomain: optionalString,
      customDomain: optionalString,
    })
    .default({}),
  address: z
    .object({
      display: optionalString,
      mapUrl: optionalString,
      embedUrl: optionalString,
      latitude: optionalNumber,
      longitude: optionalNumber,
    })
    .default({}),
  hours: hoursSchema.default([]),
  contact: z
    .object({
      whatsapp: optionalString,
      phone: optionalString,
      email: z.string().email().optional().or(z.literal('')),
      wifi: z
        .object({
          ssid: optionalString,
          password: optionalString,
          security: optionalString,
          title: optionalString,
          description: optionalString,
        })
        .optional(),
      pix: z
        .object({
          keyType: optionalString,
          key: optionalString,
          receiverName: optionalString,
          city: optionalString,
          description: optionalString,
          actionLabel: optionalString,
          actionDescription: optionalString,
        })
        .optional(),
    })
    .default({}),
  seo: z.object({
    title: optionalString,
    description: optionalString,
    imageUrl: optionalString,
    imagePublicId: optionalString,
  }),
});

const themeBodySchema = z.object({
  colors: z.record(z.string()),
  typography: z.record(z.string()),
  spacing: z.record(z.string()),
  radius: z.record(z.string()),
  layout: z.record(z.string()),
  buttons: z.record(z.any()),
  customCss: optionalString,
});

const linksBodySchema = z.array(
  z.object({
    id: optionalString,
    type: z.enum(LINK_TYPE_VALUES),
    group: z.enum(Object.values(LINK_GROUPS)).default(LINK_GROUPS.PRIMARY),
    label: optionalString,
    subtitle: optionalString,
    icon: optionalString,
    url: optionalString,
    value: optionalString,
    visible: z.boolean().default(true),
    order: z.number().int().default(0),
    target: z.enum(['_self', '_blank']).default('_blank'),
    metadata: z.record(z.any()).default({}),
  }),
);

const sectionsBodySchema = z.array(
  z.object({
    id: optionalString,
    key: z.string().min(1),
    type: z.enum(SECTION_TYPE_VALUES),
    title: optionalString,
    description: optionalString,
    order: z.number().int().default(0),
    visible: z.boolean().default(true),
    variant: optionalString,
    settings: z.record(z.any()).default({}),
    items: z.array(z.record(z.any())).default([]),
  }),
);

export const adminBusinessParamsSchema = z.object({
  businessId: z.string().min(12),
});

export const adminBusinessEditorBodySchema = z.object({
  business: businessBodySchema,
  theme: themeBodySchema,
  links: linksBodySchema.default([]),
  sections: sectionsBodySchema.default([]),
  nfcTag: z
    .object({
      code: optionalString,
      status: optionalString,
    })
    .nullable()
    .optional(),
});

export const adminBusinessCreateBodySchema = z
  .object({
    business: businessBodySchema.partial().optional(),
    theme: themeBodySchema.optional(),
    links: linksBodySchema.optional(),
    sections: sectionsBodySchema.optional(),
    nfcTag: z
      .object({
        code: optionalString,
        status: optionalString,
      })
      .nullable()
      .optional(),
  })
  .refine((value) => Boolean(value.business?.name || value.business?.slug), {
    message: 'Informe ao menos nome ou slug para criar o comercio',
    path: ['business'],
  });
