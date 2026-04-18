import { v2 as cloudinary } from 'cloudinary';
import { AppError } from './appError.js';

let configured = false;

function assertCloudinaryEnvironment() {
  const missingVariables = [
    ['CLOUDINARY_CLOUD_NAME', process.env.CLOUDINARY_CLOUD_NAME],
    ['CLOUDINARY_API_KEY', process.env.CLOUDINARY_API_KEY],
    ['CLOUDINARY_API_SECRET', process.env.CLOUDINARY_API_SECRET],
  ]
    .filter(([, value]) => !String(value || '').trim())
    .map(([name]) => name);

  if (missingVariables.length) {
    throw new AppError(
      `Cloudinary nao configurado. Variaveis ausentes: ${missingVariables.join(', ')}`,
      500,
      'cloudinary_not_configured',
    );
  }
}

export function getCloudinaryClient() {
  assertCloudinaryEnvironment();

  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}
