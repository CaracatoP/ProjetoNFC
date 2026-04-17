import { saveImageUpload } from '../utils/storage.js';

export async function uploadAdminImage(file) {
  return saveImageUpload(file);
}
