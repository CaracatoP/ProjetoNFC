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
  seo: seoSchema,
});

export const slugParamsSchema = z.object({
  slug: z.string().min(2),
});

export const tagParamsSchema = z.object({
  tagCode: z.string().min(3),
});

