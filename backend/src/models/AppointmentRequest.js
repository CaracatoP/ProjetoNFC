import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const APPOINTMENT_REQUEST_STATUS_VALUES = ['pending', 'confirmed', 'cancelled'];

const appointmentRequestSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    professionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Professional', index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppointmentService', index: true },
    professionalName: { type: String, trim: true },
    serviceName: { type: String, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    requestedDate: { type: String, required: true, trim: true },
    requestedTime: { type: String, required: true, trim: true },
    status: { type: String, enum: APPOINTMENT_REQUEST_STATUS_VALUES, default: 'pending', index: true },
    notes: { type: String, trim: true },
  },
  baseSchemaOptions,
);

appointmentRequestSchema.index({ businessId: 1, status: 1, createdAt: -1 });

export const AppointmentRequest =
  mongoose.models.AppointmentRequest || mongoose.model('AppointmentRequest', appointmentRequestSchema);
