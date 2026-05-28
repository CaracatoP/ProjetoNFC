export const ADMIN_UPLOAD_ASSET_TYPES = ['logo', 'banner', 'site-icon', 'service', 'gallery', 'product', 'professional'];

export const CLIENT_PANEL_UPLOAD_ASSET_TYPES = ['logo', 'banner', 'product', 'professional'];

export function normalizeUploadAssetType(value) {
  return String(value || '').trim().toLowerCase();
}

export function isAllowedAdminUploadAssetType(value) {
  return ADMIN_UPLOAD_ASSET_TYPES.includes(normalizeUploadAssetType(value));
}

export function isAllowedClientPanelUploadAssetType(value) {
  return CLIENT_PANEL_UPLOAD_ASSET_TYPES.includes(normalizeUploadAssetType(value));
}
