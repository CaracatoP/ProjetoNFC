import mongoose from 'mongoose';
import { z } from 'zod';

const objectIdPattern = /^[a-f\d]{24}$/i;

function isValidObjectId(value) {
  const normalized = String(value || '').trim();
  return objectIdPattern.test(normalized) && mongoose.Types.ObjectId.isValid(normalized);
}

export const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => isValidObjectId(value), 'Informe um identificador valido');

export const optionalObjectIdSchema = z.preprocess(
  (value) => (value === undefined || value === null || value === '' ? undefined : value),
  objectIdSchema.optional(),
);
