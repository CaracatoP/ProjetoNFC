import crypto from 'node:crypto';
import { env } from '../config/env.js';

const SECRET_ENVELOPE_VERSION = 'v1';
const IV_LENGTH = 12;

function resolveEncryptionKey(rawKey = env.paymentCredentialsEncryptionKey) {
  const normalized = String(rawKey || '').trim();

  if (!normalized) {
    throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY is required to store payment credentials securely.');
  }

  const hexCandidate =
    normalized.length === 64 && /^[0-9a-f]+$/i.test(normalized)
      ? Buffer.from(normalized, 'hex')
      : null;

  if (hexCandidate?.length === 32) {
    return hexCandidate;
  }

  const base64Candidate = /^[A-Za-z0-9+/=]+$/.test(normalized)
    ? Buffer.from(normalized, 'base64')
    : null;

  if (base64Candidate?.length === 32) {
    return base64Candidate;
  }

  const utf8Candidate = Buffer.from(normalized, 'utf8');

  if (utf8Candidate.length === 32) {
    return utf8Candidate;
  }

  throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY must resolve to exactly 32 bytes.');
}

export function encryptSecret(value, rawKey = env.paymentCredentialsEncryptionKey) {
  const normalizedValue = String(value || '');

  if (!normalizedValue) {
    return '';
  }

  const key = resolveEncryptionKey(rawKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(normalizedValue, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    SECRET_ENVELOPE_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptSecret(value, rawKey = env.paymentCredentialsEncryptionKey) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '';
  }

  const [version, ivBase64, tagBase64, payloadBase64] = normalizedValue.split(':');

  if (version !== SECRET_ENVELOPE_VERSION || !ivBase64 || !tagBase64 || !payloadBase64) {
    throw new Error('Invalid encrypted secret format.');
  }

  const key = resolveEncryptionKey(rawKey);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivBase64, 'base64'),
  );

  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function hasPaymentCredentialsEncryptionKey(rawKey = env.paymentCredentialsEncryptionKey) {
  try {
    resolveEncryptionKey(rawKey);
    return true;
  } catch {
    return false;
  }
}
