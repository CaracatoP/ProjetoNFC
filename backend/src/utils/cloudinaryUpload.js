import path from 'node:path';
import { AppError } from './appError.js';
import { getCloudinaryClient } from './cloudinary.js';
import { hasValidImageSignature } from './imageValidation.js';

function sanitizeSegment(value, fallback = 'default') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
}

function buildPublicId(originalName, assetType = 'image') {
  const extension = path.extname(originalName || '');
  const baseName = path.basename(originalName || 'imagem', extension);
  return `${sanitizeSegment(assetType, 'image')}-${Date.now()}-${sanitizeSegment(baseName, 'arquivo')}`;
}

export function buildTenantAssetFolder(tenantSlug = 'default') {
  return `taplink/${sanitizeSegment(tenantSlug, 'default')}`;
}

export async function uploadImageBufferToCloudinary(file, options = {}) {
  if (!file?.buffer?.length) {
    throw new AppError('Nenhuma imagem valida foi enviada para o Cloudinary', 400, 'upload_missing_buffer');
  }

  if (!hasValidImageSignature(file)) {
    throw new AppError('O arquivo enviado nao parece ser uma imagem valida', 400, 'upload_invalid_image');
  }

  const cloudinary = getCloudinaryClient();
  const folder = options.folder || buildTenantAssetFolder();
  const publicId = options.publicId || buildPublicId(file.originalname, options.assetType);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(
            new AppError(
              error.message || 'Falha ao enviar a imagem para o Cloudinary',
              502,
              'cloudinary_upload_failed',
            ),
          );
          return;
        }

        if (!result?.secure_url || !result?.public_id) {
          reject(
            new AppError(
              'Cloudinary nao retornou os dados esperados para a imagem enviada',
              502,
              'cloudinary_upload_invalid_response',
            ),
          );
          return;
        }

        resolve(result);
      },
    );

    uploadStream.end(file.buffer);
  });
}

export async function destroyCloudinaryAsset(publicId, options = {}) {
  if (!String(publicId || '').trim()) {
    return null;
  }

  const cloudinary = getCloudinaryClient();
  return cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
    ...options,
  });
}
