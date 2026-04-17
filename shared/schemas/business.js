import { z } from 'zod';
import { BUSINESS_STATUS_VALUES } from '../constants/index.js';

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

export const businessWifiSchema = z.object({
  ssid: z.string(),
  password: z.string(),
  security: z.string().default('WPA'),
  title: z.string().optional(),
  description: z.string().optional(),
});

export const businessPixSchema = z.object({
  keyType: z.string(),
  key: z.string(),
  receiverName: z.string(),
  city: z.string(),
  description: z.string().optional(),
  actionLabel: z.string().optional(),
  actionDescription: z.string().optional(),
});

export const businessContactSchema = z.object({
  whatsapp: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  wifi: businessWifiSchema.optional(),
  pix: businessPixSchema.optional(),
});

export const seoSchema = z.object({
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
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
  contact: businessContactSchema.default({}),
  seo: seoSchema,
});

