import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const appointmentServiceSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: 30 },
    description: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  baseSchemaOptions,
);

appointmentServiceSchema.index({ businessId: 1, active: 1, createdAt: 1 });

export const AppointmentService =
  mongoose.models.AppointmentService || mongoose.model('AppointmentService', appointmentServiceSchema);
