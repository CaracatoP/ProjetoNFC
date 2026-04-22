import { appConfig } from '@/config/appConfig.js';
import { apiRequest } from '@/services/apiClient.js';
import { buildAdminAuthHeaders } from '@/services/authService.js';
import { normalizeEditorPayload } from '@/services/mediaNormalizer.js';
import { resolveMediaUrl } from '@/utils/formatters.js';

export async function fetchAdminOverview(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/dashboard/overview`, {
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function listAdminBusinesses(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses`, {
    headers: buildAdminAuthHeaders(token),
  });

  return response.data.map((business) => ({
    ...business,
    logoUrl: resolveMediaUrl(business.logoUrl),
  }));
}

export async function getAdminBusiness(token, businessId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}`, {
    headers: buildAdminAuthHeaders(token),
  });

  return normalizeEditorPayload(response.data);
}

export async function createAdminBusiness(token, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return normalizeEditorPayload(response.data);
}

export async function updateAdminBusiness(token, businessId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}`, {
    method: 'PUT',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return normalizeEditorPayload(response.data);
}

export async function updateAdminBusinessStatus(token, businessId, status) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/status`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  return normalizeEditorPayload(response.data);
}

export async function deleteAdminBusiness(token, businessId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}`, {
    method: 'DELETE',
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function uploadAdminImage(token, file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (options.tenantSlug) {
    formData.append('tenantSlug', options.tenantSlug);
  }
  if (options.assetType) {
    formData.append('assetType', options.assetType);
  }

  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/uploads/image`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
    body: formData,
  });

  return {
    ...response.data,
    url: resolveMediaUrl(response.data.url),
  };
}
