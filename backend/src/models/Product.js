import mongoose from 'mongoose';
import {
  DEFAULT_PRODUCT_MEASUREMENT_UNIT,
  PRODUCT_MEASUREMENT_UNIT_VALUES,
} from '../../../shared/constants/index.js';
import { normalizeMeasurementUnit } from '../../../shared/utils/productMeasurement.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const baseToJSONTransform = baseSchemaOptions.toJSON?.transform;
const baseToObjectTransform = baseSchemaOptions.toObject?.transform;

const productOptionSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    value: { type: String, trim: true },
    priceDelta: { type: Number, default: 0 },
  },
  {
    _id: false,
    strict: false,
  },
);

const productSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, default: 0 },
    image: { type: String, trim: true },
    imagePublicId: { type: String, trim: true },
    category: { type: String, trim: true },
    measurementUnit: {
      type: String,
      enum: PRODUCT_MEASUREMENT_UNIT_VALUES,
      default: DEFAULT_PRODUCT_MEASUREMENT_UNIT,
      trim: true,
    },
    active: { type: Boolean, default: true, index: true },
    options: { type: [productOptionSchema], default: [] },
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      ...baseSchemaOptions.toJSON,
      transform: (doc, ret) => {
        const transformed = baseToJSONTransform ? baseToJSONTransform(doc, ret) : ret;
        transformed.measurementUnit = normalizeMeasurementUnit(transformed.measurementUnit);
        return transformed;
      },
    },
    toObject: {
      ...baseSchemaOptions.toObject,
      transform: (doc, ret) => {
        const transformed = baseToObjectTransform ? baseToObjectTransform(doc, ret) : ret;
        transformed.measurementUnit = normalizeMeasurementUnit(transformed.measurementUnit);
        return transformed;
      },
    },
  },
);

productSchema.index({ businessId: 1, active: 1, createdAt: -1 });
productSchema.index({ businessId: 1, category: 1, createdAt: -1 });

export const Product =
  mongoose.models.Product || mongoose.model('Product', productSchema);
