import { z } from 'zod';
import { businessSchema, seoSchema } from './business.js';
import { businessLinkArraySchema } from './link.js';
import { businessSectionArraySchema } from './section.js';
import { themeSchema } from './theme.js';

export const publicSitePayloadSchema = z.object({
  business: businessSchema,
  theme: themeSchema,
  sections: businessSectionArraySchema,
  links: businessLinkArraySchema,
  modulesData: z
    .object({
      professionals: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            role: z.string().optional(),
            avatar: z.string().optional().or(z.literal('')),
            active: z.boolean().optional(),
          }),
        )
        .default([]),
      appointmentServices: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            price: z.number().default(0),
            durationMinutes: z.number().int().default(0),
            description: z.string().optional().or(z.literal('')),
            active: z.boolean().optional(),
          }),
        )
        .default([]),
      products: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional().or(z.literal('')),
            price: z.number().default(0),
            image: z.string().optional().or(z.literal('')),
            category: z.string().optional().or(z.literal('')),
            active: z.boolean().optional(),
            options: z.array(z.any()).optional(),
          }),
        )
        .default([]),
    })
    .default({
      professionals: [],
      appointmentServices: [],
      products: [],
    }),
  seo: seoSchema,
});

export const slugParamsSchema = z.object({
  slug: z.string().min(2),
});

export const tagParamsSchema = z.object({
  tagCode: z.string().min(3),
});
