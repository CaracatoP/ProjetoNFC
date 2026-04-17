import { appConfig } from '@/config/appConfig.js';

export async function trackEvent(payload) {
  try {
    await fetch(`${appConfig.apiBaseUrl}/public/analytics/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    console.warn('Falha ao registrar analytics:', error);
  }
}

