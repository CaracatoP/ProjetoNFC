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

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nfc-linktree-saas',
  frontendOrigins: parseList(process.env.FRONTEND_ORIGIN, ['http://localhost:5173']),
  analyticsSalt: process.env.ANALYTICS_SALT || 'nfc-linktree-saas-demo-salt',
  publicSiteBaseUrl: process.env.PUBLIC_SITE_BASE_URL || 'http://localhost:5173',
  apiPublicBaseUrl: process.env.API_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  enableDemoSeed: String(process.env.ENABLE_DEMO_SEED || 'true') === 'true',
  adminUsername: process.env.ADMIN_USERNAME || 'joaogabrielcaracato@gmail.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'Jo@o240107',
  adminDisplayName: process.env.ADMIN_DISPLAY_NAME || 'Operacao NFC',
  adminTokenSecret: process.env.ADMIN_TOKEN_SECRET || 'troque-este-token-admin',
  adminSessionTtlHours: Number(process.env.ADMIN_SESSION_TTL_HOURS || 12),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 5),
};
