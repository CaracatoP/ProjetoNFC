import { z } from 'zod';
import {
  BUSINESS_STATUS,
  BUSINESS_STATUS_VALUES,
  LINK_GROUPS,
  LINK_TYPE_VALUES,
  SECTION_TYPE_VALUES,
} from '../../../shared/constants/index.js';
import { normalizeHost, slugify } from '../../../shared/utils/tenantIdentity.js';

const optionalString = z.string().optional().or(z.literal(''));
const slugPattern = /^[a-z0-9-]+$/;
const subdomainPattern = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const customDomainPattern = /^(?!:\/\/)(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isValidActionUrl(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return true;
  }

  if (normalized.startsWith('/') || normalized.startsWith('mailto:') || normalized.startsWith('tel:')) {
    return true;
  }

  return isValidHttpUrl(normalized);
}

function optionalHttpUrlSchema(message) {
  return z.preprocess(
    (value) => (value === null || value === undefined ? value : String(value).trim()),
    z
      .union([z.string().refine((value) => !value || isValidHttpUrl(value), message), z.literal(''), z.null()])
      .optional(),
  );
}

const optionalActionUrlSchema = z.preprocess(
  (value) => (value === null || value === undefined ? value : String(value).trim()),
  z.string().refine((value) => !value || isValidActionUrl(value), 'Use uma URL valida para este link').optional().or(z.literal('')),
);

function normalizeSubdomain(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return slugify(value);
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

const optionalSubdomainSchema = z.preprocess(
  (value) => normalizeSubdomain(value),
  z.union([
    z.string().regex(subdomainPattern, 'Informe um subdominio valido usando apenas letras, numeros e hifens'),
    z.literal(''),
  ]),
);

const optionalCustomDomainSchema = z.preprocess(
  (value) => normalizeHost(value),
  z.union([
    z.string().regex(customDomainPattern, 'Informe um dominio customizado valido'),
    z.literal(''),
  ]),
);

const businessBodySchema = z.object({
  name: z.string().min(2),
  legalName: optionalString,
  slug: slugSchema,
  description: optionalString,
  logoUrl: optionalHttpUrlSchema('Logo precisa ser uma URL http/https valida'),
  logoPublicId: optionalString,
  bannerUrl: optionalHttpUrlSchema('Banner precisa ser uma URL http/https valida'),
  bannerPublicId: optionalString,
  badge: optionalString,
  status: z.enum(BUSINESS_STATUS_VALUES),
  rating: optionalString,
  domains: z
    .object({
      subdomain: optionalSubdomainSchema,
      customDomain: optionalCustomDomainSchema,
    })
    .default({}),
  address: z
    .object({
      display: optionalString,
      mapUrl: optionalHttpUrlSchema('Mapa precisa ser uma URL http/https valida'),
      embedUrl: optionalHttpUrlSchema('Mapa incorporado precisa ser uma URL http/https valida'),
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
    imageUrl: optionalHttpUrlSchema('Imagem de SEO precisa ser uma URL http/https valida'),
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
    url: optionalActionUrlSchema,
    value: optionalString,
    visible: z.boolean().default(true),
    order: z.number().int().default(0),
    target: z.enum(['_self', '_blank']).default('_blank'),
    metadata: z.record(z.any()).default({}),
  }),
);

const sectionItemBodySchema = z
  .object({
    imageUrl: optionalHttpUrlSchema('Imagem da secao precisa ser uma URL http/https valida'),
    imagePublicId: optionalString,
  })
  .catchall(z.any());

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
    items: z.array(sectionItemBodySchema).default([]),
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

export const adminBusinessStatusBodySchema = z.object({
  status: z.enum([BUSINESS_STATUS.ACTIVE, BUSINESS_STATUS.INACTIVE]),
});
