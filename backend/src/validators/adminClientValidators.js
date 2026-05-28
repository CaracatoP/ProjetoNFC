import { z } from 'zod';

const objectIdSchema = z.string().trim().min(1);
const emailSchema = z.string().trim().email();
const nameSchema = z.string().trim().min(2).max(120);
const passwordSchema = z.string().min(8).max(128);
const roleLevelSchema = z.number().int().min(0).max(5);

export const adminClientParamsSchema = z.object({
  clientId: objectIdSchema,
});

export const adminClientsQuerySchema = z.object({
  q: z.string().trim().optional(),
  planCode: z.string().trim().optional(),
  billingStatus: z.string().trim().optional(),
  roleLevel: z.string().trim().optional(),
  businessId: z.string().trim().optional(),
});

export const createAdminClientBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  roleLevel: roleLevelSchema,
  businessId: objectIdSchema,
  active: z.boolean().optional(),
});

export const updateAdminClientBodySchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    roleLevel: roleLevelSchema.optional(),
    businessId: objectIdSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe ao menos um campo para atualizar o cliente',
  });

export const updateAdminClientAccessLevelBodySchema = z.object({
  roleLevel: roleLevelSchema,
});

export const resetAdminClientPasswordBodySchema = z.object({
  password: passwordSchema,
});

export const updateAdminClientPlanBodySchema = z.object({
  planCode: z.string().trim().min(2).max(60),
});

export const updateAdminClientBillingStatusBodySchema = z.object({
  billingStatus: z.string().trim().min(4).max(40),
});
