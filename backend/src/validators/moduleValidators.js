import { z } from 'zod';

const optionalString = z.string().optional().or(z.literal(''));

export const businessIdParamsSchema = z.object({
  businessId: z.string().min(12),
});

export const resourceIdParamsSchema = z.object({
  id: z.string().min(12),
});

export const scopedResourceParamsSchema = businessIdParamsSchema.extend({
  id: z.string().min(12),
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
  active: z.boolean().default(true),
  options: z.array(z.any()).optional().default([]),
});

export const appointmentRequestBodySchema = z.object({
  professionalId: optionalString,
  serviceId: optionalString,
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

export const orderItemBodySchema = z.object({
  productId: optionalString,
  name: z.string().min(2),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  notes: optionalString,
});

export const orderBodySchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(8),
  items: z.array(orderItemBodySchema).min(1),
  deliveryType: z.enum(['pickup', 'delivery']).default('pickup'),
  address: optionalString,
  notes: optionalString,
});

export const orderStatusBodySchema = z.object({
  status: z.enum(['received', 'preparing', 'ready', 'delivered', 'cancelled']),
});
