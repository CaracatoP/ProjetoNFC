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

export async function resetAdminAnalytics(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/dashboard/analytics/reset`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function fetchAdminFinanceSettings(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/finance/settings`, {
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function updateAdminFinanceSettings(token, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/finance/settings`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function fetchAdminBusinessFinanceSettings(token, businessId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/finance/businesses/${businessId}`, {
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function updateAdminBusinessFinanceSettings(token, businessId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/finance/businesses/${businessId}`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function createAdminBusinessAsaasSubaccount(token, businessId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/finance/businesses/${businessId}/asaas/subaccount`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

function buildQueryString(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
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

export async function createAdminPreviewToken(token, businessId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/preview-token`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
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

export async function createTenantProfessional(token, businessId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/professionals`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateTenantProfessional(token, businessId, professionalId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/professionals/${professionalId}`, {
    method: 'PUT',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function deleteTenantProfessional(token, businessId, professionalId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/professionals/${professionalId}`, {
    method: 'DELETE',
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function createTenantAppointmentService(token, businessId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/appointment-services`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateTenantAppointmentService(token, businessId, serviceId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/appointment-services/${serviceId}`, {
    method: 'PUT',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function deleteTenantAppointmentService(token, businessId, serviceId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/appointment-services/${serviceId}`, {
    method: 'DELETE',
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function createTenantProduct(token, businessId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/products`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateTenantProduct(token, businessId, productId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/products/${productId}`, {
    method: 'PUT',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function deleteTenantProduct(token, businessId, productId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/products/${productId}`, {
    method: 'DELETE',
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function updateTenantAppointmentRequestStatus(token, businessId, requestId, status) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/appointment-requests/${requestId}/status`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  return response.data;
}

export async function updateTenantOrderStatus(token, businessId, orderId, status) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  return response.data;
}

export async function updateTenantOrderPaymentStatus(token, businessId, orderId, status) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/businesses/${businessId}/orders/${orderId}/payment-status`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  return response.data;
}

export async function listAdminClients(token, filters = {}) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients${buildQueryString(filters)}`, {
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function getAdminClient(token, clientId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients/${clientId}`, {
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function createAdminClientAccount(token, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateAdminClientAccount(token, clientId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients/${clientId}`, {
    method: 'PUT',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateAdminClientAccessLevel(token, clientId, roleLevel) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients/${clientId}/access-level`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify({ roleLevel }),
  });

  return response.data;
}

export async function resetAdminClientPassword(token, clientId, password) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients/${clientId}/reset-password`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify({ password }),
  });

  return response.data;
}

export async function blockAdminClient(token, clientId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients/${clientId}/block`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function unblockAdminClient(token, clientId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients/${clientId}/unblock`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function updateAdminClientPlan(token, clientId, planCode) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients/${clientId}/plan`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify({ planCode }),
  });

  return response.data;
}

export async function updateAdminClientBillingStatus(token, clientId, billingStatus) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/clients/${clientId}/billing-status`, {
    method: 'PATCH',
    headers: buildAdminAuthHeaders(token),
    body: JSON.stringify({ billingStatus }),
  });

  return response.data;
}
