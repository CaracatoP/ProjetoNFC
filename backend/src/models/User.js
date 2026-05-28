import mongoose from 'mongoose';
import { ADMIN_ROLE_VALUES, ADMIN_USER_STATUS_VALUES } from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const USER_ROLE_LEVEL_VALUES = [0, 1, 2, 3, 4, 5];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    passwordHash: { type: String, trim: true, required: true },
    roles: {
      type: [String],
      enum: ADMIN_ROLE_VALUES,
      default: ['admin'],
    },
    roleLevel: {
      type: Number,
      enum: USER_ROLE_LEVEL_VALUES,
      default: 1,
      index: true,
    },
    bootstrapManaged: { type: Boolean, default: false, index: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    businessIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Business' }],
    status: { type: String, enum: ADMIN_USER_STATUS_VALUES, default: 'active', trim: true, index: true },
    lastLoginAt: Date,
  },
  baseSchemaOptions,
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
