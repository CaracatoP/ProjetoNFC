import crypto from 'node:crypto';
import { env } from '../config/env.js';

function encodeTokenPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeTokenPart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signPayload(payload) {
  return crypto.createHmac('sha256', env.adminTokenSecret).update(payload).digest('base64url');
}

export function getAdminUserProfile() {
  return {
    username: env.adminUsername,
    displayName: env.adminDisplayName,
    role: 'internal_admin',
  };
}

export function createAdminSessionToken() {
  const expiresAt = Date.now() + env.adminSessionTtlHours * 60 * 60 * 1000;
  const payload = encodeTokenPart({
    sub: env.adminUsername,
    role: 'internal_admin',
    exp: expiresAt,
  });
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(token) {
  const [payloadPart, signaturePart] = String(token || '').split('.');

  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expectedSignature = signPayload(payloadPart);
  const providedBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  const validSignature = crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!validSignature) {
    return null;
  }

  const payload = decodeTokenPart(payloadPart);

  if (!payload?.sub || payload.exp < Date.now()) {
    return null;
  }

  return getAdminUserProfile();
}
