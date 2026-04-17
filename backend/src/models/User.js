import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    passwordHash: { type: String, trim: true },
    roles: { type: [String], default: ['owner'] },
    businessIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Business' }],
    status: { type: String, default: 'invited', trim: true },
  },
  baseSchemaOptions,
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);

