import mongoose from 'mongoose';
import {
  DEFAULT_PRODUCT_MEASUREMENT_UNIT,
  DEFAULT_PAYMENT_PROVIDER,
  DEFAULT_PAYMENT_STATUS,
  PAYMENT_METHOD_VALUES,
  PAYMENT_PROVIDER_VALUES,
  PAYMENT_STATUS_VALUES,
  PRODUCT_MEASUREMENT_UNIT_VALUES,
} from '../../../shared/constants/index.js';
import {
  buildLegacyDisplayQuantity,
  calculateMeasuredItemTotal,
  isValidMeasurementQuantity,
  normalizeMeasurementUnit,
} from '../../../shared/utils/productMeasurement.js';
import {
  normalizeOrderPayment,
  normalizeOrderPaymentEvents,
} from '../../../shared/utils/businessPayment.js';
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

const orderPaymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      default: 'cash_on_pickup',
      trim: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: DEFAULT_PAYMENT_STATUS,
      trim: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDER_VALUES,
      default: DEFAULT_PAYMENT_PROVIDER,
      trim: true,
    },
    amount: { type: Number, required: true, min: 0, default: 0 },
    platformFeeAmount: { type: Number, min: 0, default: 0 },
    tenantNetAmount: { type: Number, min: 0, default: 0 },
    pixCopyPaste: { type: String, trim: true, default: '' },
    pixQrCodeUrl: { type: String, trim: true, default: '' },
    pixQrCode: { type: String, trim: true, default: '' },
    providerPaymentId: { type: String, trim: true, default: '' },
    providerCustomerId: { type: String, trim: true, default: '' },
    providerPreferenceId: { type: String, trim: true, default: '' },
    checkoutUrl: { type: String, trim: true, default: '' },
    invoiceUrl: { type: String, trim: true, default: '' },
    bankSlipUrl: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
  },
  {
    _id: false,
  },
);

const orderPaymentEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDER_VALUES,
      default: DEFAULT_PAYMENT_PROVIDER,
      trim: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: DEFAULT_PAYMENT_STATUS,
      trim: true,
    },
    message: { type: String, trim: true, default: '' },
    providerEvent: { type: String, trim: true, default: '' },
    providerPaymentId: { type: String, trim: true, default: '' },
    occurredAt: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
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
    receivedAt: { type: Date, default: null },
    preparingAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    notes: { type: String, trim: true },
    payment: { type: orderPaymentSchema, default: undefined },
    paymentEvents: { type: [orderPaymentEventSchema], default: [] },
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
        transformed.payment = normalizeOrderPayment(transformed.payment || {}, transformed.total);
        transformed.paymentEvents = normalizeOrderPaymentEvents(transformed.paymentEvents || []);
        return transformed;
      },
    },
    toObject: {
      ...baseSchemaOptions.toObject,
      transform: (doc, ret) => {
        const transformed = baseToObjectTransform ? baseToObjectTransform(doc, ret) : ret;
        transformed.items = normalizeOrderItems(transformed.items);
        transformed.total = Number(Number(transformed.total || 0).toFixed(2));
        transformed.payment = normalizeOrderPayment(transformed.payment || {}, transformed.total);
        transformed.paymentEvents = normalizeOrderPaymentEvents(transformed.paymentEvents || []);
        return transformed;
      },
    },
  },
);

orderSchema.index({ businessId: 1, status: 1, createdAt: -1 });
orderSchema.index({ businessId: 1, archivedAt: 1, createdAt: -1 });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
