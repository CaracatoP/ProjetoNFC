import { z } from 'zod';

const loginIdentifierSchema = z.string().trim().min(3).max(120);

export const sessionLoginBodySchema = z
  .object({
    username: loginIdentifierSchema.optional(),
    email: loginIdentifierSchema.optional(),
    password: z.string().min(8).max(128),
  })
  .refine((value) => Boolean(value.username || value.email), {
    message: 'Informe o e-mail para entrar',
    path: ['username'],
  });
