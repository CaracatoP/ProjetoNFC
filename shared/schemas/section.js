import { z } from 'zod';
import { SECTION_TYPE_VALUES } from '../constants/index.js';
import { businessLinkSchema } from './link.js';

export const serviceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number().nonnegative().optional(),
  ctaLabel: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const galleryItemSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  alt: z.string().optional(),
});

export const reviewItemSchema = z.object({
  id: z.string(),
  author: z.string(),
  rating: z.number().min(0).max(5).default(5),
  quote: z.string(),
});

export const sectionItemSchema = z.union([
  serviceItemSchema,
  galleryItemSchema,
  reviewItemSchema,
  businessLinkSchema,
  z.record(z.any()),
]);

export const businessSectionSchema = z.object({
  id: z.string(),
  key: z.string(),
  type: z.enum(SECTION_TYPE_VALUES),
  title: z.string().optional(),
  description: z.string().optional(),
  order: z.number().int().default(0),
  visible: z.boolean().default(true),
  variant: z.string().optional(),
  settings: z.record(z.any()).default({}),
  items: z.array(sectionItemSchema).default([]),
});

export const businessSectionArraySchema = z.array(businessSectionSchema);
