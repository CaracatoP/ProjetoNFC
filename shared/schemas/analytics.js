import { z } from 'zod';
import { ANALYTICS_EVENT_TYPE_VALUES, SECTION_TYPE_VALUES } from '../constants/index.js';

export const analyticsEventSchema = z
  .object({
    slug: z.string().optional(),
    businessId: z.string().optional(),
    eventType: z.enum(ANALYTICS_EVENT_TYPE_VALUES),
    sectionType: z.enum(SECTION_TYPE_VALUES).optional(),
    targetType: z.string().optional(),
    targetId: z.string().optional(),
    targetLabel: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .refine((value) => value.slug || value.businessId, {
    message: 'slug ou businessId são obrigatórios',
    path: ['slug'],
  });

