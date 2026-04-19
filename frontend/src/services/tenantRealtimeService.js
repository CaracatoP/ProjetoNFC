import { appConfig } from '@/config/appConfig.js';

function buildRealtimeQuery(target = {}) {
  const params = new URLSearchParams();

  if (target.businessId) {
    params.set('businessId', String(target.businessId));
  }

  if (target.slug) {
    params.set('slug', String(target.slug));
  }

  if (target.host) {
    params.set('host', String(target.host));
  }

  return params.toString();
}

export function subscribeToTenantUpdates(target, callbacks = {}) {
  const query = buildRealtimeQuery(target);

  if (!query) {
    return () => {};
  }

  const eventSource = new EventSource(`${appConfig.apiBaseUrl}/public/realtime/tenant?${query}`);

  const handleTenantUpdated = (event) => {
    try {
      const payload = JSON.parse(event.data || '{}');
      callbacks.onTenantUpdated?.(payload);
    } catch {
      callbacks.onError?.(new Error('Nao foi possivel interpretar a atualizacao em tempo real do tenant.'));
    }
  };

  const handleError = (event) => {
    callbacks.onError?.(event);
  };

  eventSource.addEventListener('tenant_updated', handleTenantUpdated);
  eventSource.onerror = handleError;

  return () => {
    eventSource.removeEventListener('tenant_updated', handleTenantUpdated);
    eventSource.close();
  };
}
