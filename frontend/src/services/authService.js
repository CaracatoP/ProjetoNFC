import { appConfig } from '@/config/appConfig.js';
import { apiRequest } from '@/services/apiClient.js';

const ADMIN_TOKEN_KEY = 'nfc_admin_session_token';

export function getStoredAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function setStoredAdminToken(token) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function buildAdminAuthHeaders(token) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

export async function loginAdmin(credentials) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  return response.data;
}

export async function fetchAdminSession(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/admin/auth/session`, {
    headers: buildAdminAuthHeaders(token),
  });

  return response.data;
}

export async function logoutAdmin(token) {
  await apiRequest(`${appConfig.apiBaseUrl}/admin/auth/logout`, {
    method: 'POST',
    headers: buildAdminAuthHeaders(token),
  });
}
