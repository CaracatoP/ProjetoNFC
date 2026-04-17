import { z } from 'zod';
import { LINK_GROUPS, LINK_TYPE_VALUES } from '../constants/index.js';

export const businessLinkSchema = z.object({
  id: z.string(),
  type: z.enum(LINK_TYPE_VALUES),
  group: z.enum(Object.values(LINK_GROUPS)).default(LINK_GROUPS.PRIMARY),
  label: z.string(),
  subtitle: z.string().optional(),
  icon: z.string().optional(),
  url: z.string().optional(),
  value: z.string().optional(),
  visible: z.boolean().default(true),
  order: z.number().int().default(0),
  target: z.enum(['_self', '_blank']).default('_blank'),
  metadata: z.record(z.any()).optional(),
});

export const businessLinkArraySchema = z.array(businessLinkSchema);
