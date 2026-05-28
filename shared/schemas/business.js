import { z } from 'zod';
import { BUSINESS_MODULE_KEY_VALUES, BUSINESS_SEGMENT_VALUES, BUSINESS_STATUS_VALUES } from '../constants/index.js';
import { normalizeBusinessContact, normalizeBusinessWifi } from '../utils/businessContact.js';

export const businessHourSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

export const businessAddressSchema = z.object({
  display: z.string().optional(),
  mapUrl: z.string().optional(),
  embedUrl: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const businessWifiSchema = z.preprocess(
  (value) => normalizeBusinessWifi(value),
  z.object({
    ssid: z.string().default(''),
    password: z.string().default(''),
    security: z.string().default('WPA'),
    title: z.string().default(''),
    description: z.string().default(''),
  }),
);

export const businessPixSchema = z.object({
  keyType: z.string(),
  key: z.string(),
  receiverName: z.string(),
  city: z.string(),
  description: z.string().optional(),
  actionLabel: z.string().optional(),
  actionDescription: z.string().optional(),
});

export const businessContactSchema = z.preprocess(
  (value) => normalizeBusinessContact(value),
  z.object({
    whatsapp: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    wifi: businessWifiSchema.default(normalizeBusinessWifi()),
    pix: businessPixSchema.optional(),
  }),
);

export const seoSchema = z.object({
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
});

export const businessDomainsSchema = z.object({
  subdomain: z.string().optional().or(z.literal('')),
  customDomain: z.string().optional().or(z.literal('')),
  customDomainVerifiedAt: z.string().datetime().optional().nullable().or(z.literal('')),
});

export const businessSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  legalName: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  badge: z.string().optional(),
  status: z.enum(BUSINESS_STATUS_VALUES),
  address: businessAddressSchema.optional(),
  hours: z.array(businessHourSchema).default([]),
  rating: z.string().optional(),
  domains: businessDomainsSchema.default({}),
  contact: businessContactSchema.default(normalizeBusinessContact()),
  segment: z.enum(BUSINESS_SEGMENT_VALUES).default('other'),
  modules: z
    .object(
      BUSINESS_MODULE_KEY_VALUES.reduce((shape, key) => {
        shape[key] = z.boolean().default(false);
        return shape;
      }, {}),
    )
    .default({}),
  segmentConfig: z
    .object({
      label: z.string().optional(),
      description: z.string().optional(),
      catalogTitle: z.string().optional(),
      catalogDescription: z.string().optional(),
      appointmentTitle: z.string().optional(),
      appointmentDescription: z.string().optional(),
      loyaltyTitle: z.string().optional(),
      loyaltyDescription: z.string().optional(),
    })
    .passthrough()
    .default({}),
  seo: seoSchema,
});
