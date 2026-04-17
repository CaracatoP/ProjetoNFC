import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fsPromises } from 'node:fs';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootUploadsDir = path.resolve(__dirname, '../../../uploads');

export function ensureUploadsDirectory() {
  if (!fs.existsSync(rootUploadsDir)) {
    fs.mkdirSync(rootUploadsDir, { recursive: true });
  }
}

function slugifyFileName(value) {
  return String(value || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export async function saveImageUpload(file) {
  ensureUploadsDirectory();

  const now = new Date();
  const folderName = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const targetDir = path.join(rootUploadsDir, folderName);
  await fsPromises.mkdir(targetDir, { recursive: true });

  const extension = path.extname(file.originalname || '') || '.png';
  const filename = `${Date.now()}-${slugifyFileName(path.basename(file.originalname || 'imagem', extension))}${extension}`;
  const absolutePath = path.join(targetDir, filename);
  await fsPromises.writeFile(absolutePath, file.buffer);

  const relativePath = `${folderName}/${filename}`;
  return {
    filename,
    relativePath,
    url: `${env.apiPublicBaseUrl.replace(/\/$/, '')}/uploads/${relativePath}`,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export function getUploadsDirectory() {
  return rootUploadsDir;
}
