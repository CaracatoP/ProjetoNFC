import { z } from 'zod';

export const apiSuccessResponseSchema = (dataSchema) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(z.any()).optional(),
  });

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

