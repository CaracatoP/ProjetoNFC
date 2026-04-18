import { saveImageUpload } from '../utils/storage.js';

export async function uploadAdminImage(file, publicBaseUrl) {
  return saveImageUpload(file, publicBaseUrl);
}
