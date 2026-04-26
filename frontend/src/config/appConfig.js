export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  publicSiteBaseUrl: import.meta.env.VITE_PUBLIC_SITE_BASE_URL || '',
  demoSiteSlug: import.meta.env.VITE_DEMO_SITE_SLUG || '',
};
