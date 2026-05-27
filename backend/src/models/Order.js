import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const ORDER_STATUS_VALUES = ['received', 'preparing', 'ready', 'delivered', 'cancelled'];
const DELIVERY_TYPE_VALUES = ['pickup', 'delivery'];

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
  },
  {
    _id: false,
  },
);

const orderSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    deliveryType: { type: String, enum: DELIVERY_TYPE_VALUES, default: 'pickup' },
    address: { type: String, trim: true },
    status: { type: String, enum: ORDER_STATUS_VALUES, default: 'received', index: true },
    notes: { type: String, trim: true },
  },
  baseSchemaOptions,
);

orderSchema.index({ businessId: 1, status: 1, createdAt: -1 });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
