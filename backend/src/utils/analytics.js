import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function buildVisitorHash({ ipAddress = '', userAgent = '' }) {
  return crypto
    .createHash('sha256')
    .update(`${env.analyticsSalt}:${ipAddress}:${userAgent}`)
    .digest('hex');
}

