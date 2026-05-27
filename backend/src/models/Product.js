import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

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
    active: { type: Boolean, default: true, index: true },
    options: { type: [productOptionSchema], default: [] },
  },
  baseSchemaOptions,
);

productSchema.index({ businessId: 1, active: 1, createdAt: -1 });
productSchema.index({ businessId: 1, category: 1, createdAt: -1 });

export const Product =
  mongoose.models.Product || mongoose.model('Product', productSchema);
