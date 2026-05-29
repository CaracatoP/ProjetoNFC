import mongoose from 'mongoose';
import {
  DEFAULT_PRODUCT_MEASUREMENT_UNIT,
  PRODUCT_MEASUREMENT_UNIT_VALUES,
} from '../../../shared/constants/index.js';
import {
  buildLegacyDisplayQuantity,
  calculateMeasuredItemTotal,
  isValidMeasurementQuantity,
  normalizeMeasurementUnit,
} from '../../../shared/utils/productMeasurement.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const ORDER_STATUS_VALUES = ['received', 'preparing', 'ready', 'delivered', 'cancelled'];
const DELIVERY_TYPE_VALUES = ['pickup', 'delivery'];
const baseToJSONTransform = baseSchemaOptions.toJSON?.transform;
const baseToObjectTransform = baseSchemaOptions.toObject?.transform;

function normalizeOrderItems(items = []) {
  return (items || []).map((item) => {
    const measurementUnit = normalizeMeasurementUnit(item.measurementUnit);
    const quantity = Number(item.quantity || 0);
    const displayQuantity = String(item.displayQuantity || '').trim();
    const itemTotal = Number(item.itemTotal);

    return {
      ...item,
      measurementUnit,
      displayQuantity:
        displayQuantity || buildLegacyDisplayQuantity(quantity, measurementUnit),
      itemTotal: Number.isFinite(itemTotal)
        ? Number(itemTotal.toFixed(2))
        : calculateMeasuredItemTotal(item.unitPrice, quantity),
    };
  });
}

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
      validate: {
        validator(value) {
          return isValidMeasurementQuantity(value, this.measurementUnit);
        },
        message: 'Quantidade invalida para a unidade de medida do produto.',
      },
    },
    unitPrice: { type: Number, required: true, min: 0 },
    measurementUnit: {
      type: String,
      enum: PRODUCT_MEASUREMENT_UNIT_VALUES,
      default: DEFAULT_PRODUCT_MEASUREMENT_UNIT,
      trim: true,
    },
    displayQuantity: { type: String, trim: true },
    itemTotal: { type: Number, required: true, min: 0 },
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
    archivedAt: { type: Date, default: null, index: true },
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      ...baseSchemaOptions.toJSON,
      transform: (doc, ret) => {
        const transformed = baseToJSONTransform ? baseToJSONTransform(doc, ret) : ret;
        transformed.items = normalizeOrderItems(transformed.items);
        transformed.total = Number(Number(transformed.total || 0).toFixed(2));
        return transformed;
      },
    },
    toObject: {
      ...baseSchemaOptions.toObject,
      transform: (doc, ret) => {
        const transformed = baseToObjectTransform ? baseToObjectTransform(doc, ret) : ret;
        transformed.items = normalizeOrderItems(transformed.items);
        transformed.total = Number(Number(transformed.total || 0).toFixed(2));
        return transformed;
      },
    },
  },
);

orderSchema.index({ businessId: 1, status: 1, createdAt: -1 });
orderSchema.index({ businessId: 1, archivedAt: 1, createdAt: -1 });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
