import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const parseList = (value, fallback = []) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .concat(fallback)
    .filter((item, index, array) => array.indexOf(item) === index);

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function getDevelopmentFallback(value, fallback = '') {
  if (String(value || '').trim()) {
    return value;
  }

  return isProduction ? '' : fallback;
}

function parseTrustProxy(value) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) {
    return isProduction ? 1 : false;
  }

  if (['false', '0', 'off', 'no'].includes(normalized)) {
    return false;
  }

  if (['true', '1', 'on', 'yes'].includes(normalized)) {
    return 1;
  }

  const asNumber = Number(normalized);

  if (Number.isInteger(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  return value;
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 4000),
  mongodbUri: getDevelopmentFallback(
    process.env.MONGODB_URI,
    'mongodb://127.0.0.1:27017/taplink',
  ),
  frontendOrigins: parseList(process.env.FRONTEND_ORIGIN, isProduction ? [] : ['http://localhost:5173']),
  analyticsSalt: getDevelopmentFallback(process.env.ANALYTICS_SALT, 'dev-analytics-salt'),
  publicSiteBaseUrl: getDevelopmentFallback(process.env.PUBLIC_SITE_BASE_URL, 'http://localhost:5173'),
  apiPublicBaseUrl: getDevelopmentFallback(
    process.env.API_PUBLIC_BASE_URL,
    `http://localhost:${process.env.PORT || 4000}`,
  ),
  enableDemoSeed: String(process.env.ENABLE_DEMO_SEED || 'false') === 'true',
  adminBootstrapEmail: String(
    process.env.ADMIN_BOOTSTRAP_EMAIL || process.env.ADMIN_USERNAME || '',
  )
    .trim()
    .toLowerCase(),
  adminBootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.ADMIN_PASSWORD || '',
  adminBootstrapName: process.env.ADMIN_BOOTSTRAP_NAME || process.env.ADMIN_DISPLAY_NAME || 'Operacao TapLink',
  adminBootstrapRole: (process.env.ADMIN_BOOTSTRAP_ROLE || 'superadmin').trim().toLowerCase(),
  adminTokenSecret: getDevelopmentFallback(process.env.ADMIN_TOKEN_SECRET || process.env.JWT_SECRET, 'dev-admin-token-secret'),
  adminSessionTtlHours: Number(process.env.ADMIN_SESSION_TTL_HOURS || 12),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 5),
  authLoginRateLimitWindowMs: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  authLoginRateLimitMax: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || 10),
  uploadRateLimitWindowMs: Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  uploadRateLimitMax: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 30),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  bootstrapDefaultPlans: String(process.env.BOOTSTRAP_DEFAULT_PLANS || 'true') === 'true',
};
