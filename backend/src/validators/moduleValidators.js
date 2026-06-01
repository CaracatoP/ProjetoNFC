import { z } from 'zod';
import {
  DEFAULT_PRODUCT_MEASUREMENT_UNIT,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
  PRODUCT_MEASUREMENT_UNIT_VALUES,
} from '../../../shared/constants/index.js';
import { requiresIntegerMeasurementQuantity } from '../../../shared/utils/productMeasurement.js';
import { objectIdSchema, optionalObjectIdSchema } from './objectId.js';

const optionalString = z.string().optional().or(z.literal(''));
const measurementUnitSchema = z.enum(PRODUCT_MEASUREMENT_UNIT_VALUES).default(DEFAULT_PRODUCT_MEASUREMENT_UNIT);
const optionalMeasurementUnitSchema = z.preprocess(
  (value) => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return normalizedValue || undefined;
  },
  z.enum(PRODUCT_MEASUREMENT_UNIT_VALUES).optional(),
);
const optionalPaymentMethodSchema = z.preprocess(
  (value) => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return normalizedValue || undefined;
  },
  z.enum(PAYMENT_METHOD_VALUES).optional(),
);

export const businessIdParamsSchema = z.object({
  businessId: objectIdSchema,
});

export const resourceIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const scopedResourceParamsSchema = businessIdParamsSchema.extend({
  id: objectIdSchema,
});

export const slugOnlyParamsSchema = z.object({
  slug: z.string().min(2),
});

export const professionalBodySchema = z.object({
  name: z.string().min(2),
  role: optionalString,
  avatar: optionalString,
  active: z.boolean().default(true),
});

export const appointmentServiceBodySchema = z.object({
  name: z.string().min(2),
  price: z.number().min(0).default(0),
  durationMinutes: z.number().int().min(5).default(30),
  description: optionalString,
  active: z.boolean().default(true),
});

export const productBodySchema = z.object({
  name: z.string().min(2),
  description: optionalString,
  price: z.number().min(0).default(0),
  image: optionalString,
  imagePublicId: optionalString,
  category: optionalString,
  measurementUnit: measurementUnitSchema,
  active: z.boolean().default(true),
  options: z.array(z.any()).optional().default([]),
});

export const appointmentRequestBodySchema = z.object({
  professionalId: optionalObjectIdSchema.or(z.literal('')),
  serviceId: optionalObjectIdSchema.or(z.literal('')),
  professionalName: optionalString,
  serviceName: optionalString,
  customerName: z.string().min(2),
  customerPhone: z.string().min(8),
  requestedDate: z.string().min(4),
  requestedTime: z.string().min(2),
  notes: optionalString,
});

export const appointmentRequestStatusBodySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']),
});

export const orderItemBodySchema = z
  .object({
    productId: optionalObjectIdSchema.or(z.literal('')),
    name: z.string().min(2),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    measurementUnit: optionalMeasurementUnitSchema,
    displayQuantity: optionalString,
    itemTotal: z.number().min(0).optional(),
    notes: optionalString,
  })
  .superRefine((value, context) => {
    if (
      value.measurementUnit &&
      requiresIntegerMeasurementQuantity(value.measurementUnit) &&
      !Number.isInteger(value.quantity)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Quantidade inteira obrigatoria para esta unidade de medida.',
      });
    }
  });

export const orderBodySchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(8),
  items: z.array(orderItemBodySchema).min(1),
  deliveryType: z.enum(['pickup', 'delivery']).default('pickup'),
  address: optionalString,
  notes: optionalString,
  payment: z
    .object({
      method: optionalPaymentMethodSchema,
    })
    .optional(),
});

export const orderStatusBodySchema = z.object({
  status: z.enum(['received', 'preparing', 'ready', 'delivered', 'cancelled']),
});

export const orderPaymentStatusBodySchema = z.object({
  status: z.enum(PAYMENT_STATUS_VALUES),
});
