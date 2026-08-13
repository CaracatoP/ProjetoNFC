import crypto from 'node:crypto';

const CHECKOUT_TOKEN_BYTES = 32;

export function createPublicCheckoutToken() {
  return crypto.randomBytes(CHECKOUT_TOKEN_BYTES).toString('base64url');
}

export function hashPublicCheckoutToken(token = '') {
  return crypto.createHash('sha256').update(String(token || '').trim()).digest('hex');
}
