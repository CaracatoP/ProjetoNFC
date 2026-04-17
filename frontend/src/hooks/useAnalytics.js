import { trackEvent } from '@/services/analyticsService.js';

export function useAnalytics(site) {
  function trackPageView() {
    if (!site?.business?.slug) {
      return;
    }

    trackEvent({
      slug: site.business.slug,
      businessId: site.business.id,
      eventType: 'page_view',
      targetType: 'page',
      targetLabel: site.business.name,
    });
  }

  function trackAction(event) {
    if (!site?.business?.slug) {
      return;
    }

    trackEvent({
      slug: site.business.slug,
      businessId: site.business.id,
      ...event,
    });
  }

  return {
    trackPageView,
    trackAction,
  };
}
