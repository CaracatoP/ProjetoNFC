import { useEffect, useMemo, useRef, useState } from 'react';
import { TENANT_REALTIME_KINDS } from '@shared/constants/index.js';
import { buildBusinessSegmentState } from '@shared/utils/segments.js';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BusinessAppointmentsSection } from '@/components/business/BusinessAppointmentsSection.jsx';
import { BusinessCatalogSection } from '@/components/business/BusinessCatalogSection.jsx';
import { BusinessPixModal } from '@/components/business/BusinessPixModal.jsx';
import { BusinessLoyaltySection } from '@/components/business/BusinessLoyaltySection.jsx';
import { BusinessWifiModal } from '@/components/business/BusinessWifiModal.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { PublicSiteLayout } from '@/components/layout/PublicSiteLayout.jsx';
import { SectionRenderer } from '@/components/business/SectionRenderer.jsx';
import { useAnalytics } from '@/hooks/useAnalytics.js';
import { useBusinessSite } from '@/hooks/useBusinessSite.js';
import {
  createPublicAppointmentRequest,
  createPublicOrder,
  invalidatePublicSiteCache,
} from '@/services/publicSiteService.js';
import { subscribeToTenantUpdates } from '@/services/tenantRealtimeService.js';
import { useTenantTheme } from '@/hooks/useTenantTheme.js';
import { useTenant } from '@/context/TenantContext.jsx';
import { getSectionAnchor } from '@/utils/sections.js';

const PUBLIC_SITE_REFRESH_KINDS = new Set([
  TENANT_REALTIME_KINDS.TENANT_CREATED,
  TENANT_REALTIME_KINDS.TENANT_UPDATED,
  TENANT_REALTIME_KINDS.TENANT_STATUS_UPDATED,
  TENANT_REALTIME_KINDS.TENANT_DELETED,
  TENANT_REALTIME_KINDS.PRODUCT_CREATED,
  TENANT_REALTIME_KINDS.PRODUCT_UPDATED,
  TENANT_REALTIME_KINDS.PRODUCT_DELETED,
  TENANT_REALTIME_KINDS.PROFESSIONAL_CREATED,
  TENANT_REALTIME_KINDS.PROFESSIONAL_UPDATED,
  TENANT_REALTIME_KINDS.PROFESSIONAL_DELETED,
  TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_CREATED,
  TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_UPDATED,
  TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_DELETED,
]);

function upsertHeadLink(attributes) {
  const selector = Object.entries(attributes)
    .map(([name, value]) => `[${name}="${value}"]`)
    .join('');

  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function getPublicErrorContent(error) {
  if (error?.code === 'business_inactive') {
    return {
      title: 'Este site esta temporariamente indisponivel',
      description: 'Tente novamente mais tarde.',
    };
  }

  if (error?.status === 404) {
    return {
      title: 'Nao foi possivel carregar este tenant',
      description: error?.message || 'Negocio nao encontrado.',
    };
  }

  return {
    title: 'Nao foi possivel carregar este tenant',
    description: error?.message || 'Verifique a conexao com a API e tente novamente.',
  };
}

function TenantLoadingScreen() {
  return (
    <div className="site-loading-screen" role="status" aria-live="polite">
      <div className="site-loading-screen__pulse" aria-hidden="true" />
      <strong>Carregando pagina NFC</strong>
      <span>Preparando o conteudo do tenant com o tema mais recente.</span>
    </div>
  );
}

export function PublicSitePage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const previewQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);

    return {
      preview: params.get('preview') === '1',
      cacheBust: params.get('t') || '',
    };
  }, [location.search]);
  const { status, data: site, error, reload } = useBusinessSite(slug, previewQuery);
  const { setSite } = useTenant();
  const { trackAction, trackPageView } = useAnalytics(site);
  const segmentState = useMemo(() => buildBusinessSegmentState(site?.business || {}), [site?.business]);
  const trackedSlugRef = useRef('');
  const [activeModal, setActiveModal] = useState(null);

  useTenantTheme(site?.theme);

  useEffect(() => {
    if (!site) {
      return;
    }

    setSite(site);
    if (trackedSlugRef.current !== site.business.slug) {
      trackedSlugRef.current = site.business.slug;
      trackPageView();
    }

    document.title = site.seo.title;

    const faviconHref = site.seo.imageUrl || site.business.seo?.imageUrl || site.business.logoUrl || '';
    if (faviconHref) {
      upsertHeadLink({ rel: 'icon' }).setAttribute('href', faviconHref);
      upsertHeadLink({ rel: 'alternate icon' }).setAttribute('href', faviconHref);
      upsertHeadLink({ rel: 'shortcut icon' }).setAttribute('href', faviconHref);
    }

    const themeColor = site.theme?.colors?.background || '';
    if (themeColor) {
      let themeColorMeta = document.head.querySelector("meta[name='theme-color']");
      if (!themeColorMeta) {
        themeColorMeta = document.createElement('meta');
        themeColorMeta.setAttribute('name', 'theme-color');
        document.head.appendChild(themeColorMeta);
      }
      themeColorMeta.setAttribute('content', themeColor);
    }
  }, [setSite, site, trackPageView]);

  useEffect(() => {
    const subscriptionTarget = site?.business?.id
      ? { businessId: site.business.id }
      : slug
        ? { slug }
        : null;

    if (!subscriptionTarget) {
      return undefined;
    }

    return subscribeToTenantUpdates(subscriptionTarget, {
      onTenantUpdated(payload) {
        if (payload?.kind && !PUBLIC_SITE_REFRESH_KINDS.has(payload.kind)) {
          return;
        }

        invalidatePublicSiteCache({
          slug,
          host: window.location.host,
          domains: payload?.domains,
          previousDomains: payload?.previousDomains,
          previousSlug: payload?.previousSlug,
        });
        invalidatePublicSiteCache({
          slug: payload?.slug,
          previousSlug: payload?.previousSlug,
          domains: payload?.domains,
          previousDomains: payload?.previousDomains,
        });

        if (payload?.slug && payload.slug !== slug) {
          const previewSearch = previewQuery.preview ? `?preview=1&t=${Date.now()}` : '';
          navigate(`/site/${payload.slug}${previewSearch}`, { replace: true });
          return;
        }

        reload({
          preview: previewQuery.preview,
          bypassCache: true,
          cacheBust: String(Date.now()),
        });
      },
    });
  }, [navigate, previewQuery.preview, reload, site?.business?.id, slug]);

  function scrollToSection(sectionKey) {
    const element = document.getElementById(getSectionAnchor(sectionKey));
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function findSection(...keys) {
    return site?.sections.find((section) => keys.includes(section.key) || keys.includes(section.type));
  }

  function handleBusinessAction(actionInput) {
    const actionPayload = typeof actionInput === 'string' ? { action: actionInput } : actionInput || {};
    const action = actionPayload.action || actionPayload.type;

    if (!site || !action) {
      return;
    }

    if (action === 'wifi' && site.business.contact?.wifi?.password) {
      setActiveModal('wifi');
      return;
    }

    if (action === 'pix' && site.business.contact?.pix?.key) {
      setActiveModal('pix');
      return;
    }

    if (action === 'contact' || action === 'hours') {
      const contactSection = findSection(actionPayload.targetSection || 'contact');
      if (contactSection) {
        scrollToSection(contactSection.key);
      }
      return;
    }

    const targetSection = findSection(actionPayload.targetSection || action);

    if (targetSection?.key) {
      scrollToSection(targetSection.key);
    }
  }

  async function handleAppointmentRequest(payload) {
    if (!site?.business?.slug) {
      return;
    }

    return createPublicAppointmentRequest(site.business.slug, payload);
  }

  async function handleOrder(payload) {
    if (!site?.business?.slug) {
      return;
    }

    return createPublicOrder(site.business.slug, payload);
  }

  if (status === 'loading' || status === 'idle') {
    return <TenantLoadingScreen />;
  }

  if (status === 'error') {
    const errorContent = getPublicErrorContent(error);

    return (
      <PublicSiteLayout business={{ slug: slug || 'erro', status: 'error' }}>
        <EmptyState title={errorContent.title} description={errorContent.description} />
      </PublicSiteLayout>
    );
  }

  return (
    <PublicSiteLayout business={site.business}>
      {site.sections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          business={site.business}
          onBusinessAction={handleBusinessAction}
          onTrackAction={trackAction}
        />
      ))}
      {segmentState.modules.catalog ? (
        <BusinessCatalogSection
          tenantSlug={site.business.slug}
          modules={segmentState.modules}
          segmentConfig={segmentState.segmentConfig}
          products={site.modulesData?.products || []}
          onSubmitOrder={handleOrder}
          onTrackAction={trackAction}
        />
      ) : null}
      {segmentState.modules.appointments ? (
        <BusinessAppointmentsSection
          segmentConfig={segmentState.segmentConfig}
          professionals={site.modulesData?.professionals || []}
          appointmentServices={site.modulesData?.appointmentServices || []}
          onSubmitAppointment={handleAppointmentRequest}
          onTrackAction={trackAction}
        />
      ) : null}
      {segmentState.modules.loyalty ? (
        <BusinessLoyaltySection
          business={site.business}
          segmentConfig={segmentState.segmentConfig}
          onTrackAction={trackAction}
        />
      ) : null}
      <BusinessWifiModal
        open={activeModal === 'wifi'}
        wifi={site.business.contact?.wifi}
        onClose={() => setActiveModal(null)}
        onTrackAction={trackAction}
      />
      <BusinessPixModal
        open={activeModal === 'pix'}
        pix={site.business.contact?.pix}
        onClose={() => setActiveModal(null)}
      />
    </PublicSiteLayout>
  );
}
