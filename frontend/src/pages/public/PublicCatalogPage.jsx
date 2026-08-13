import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TENANT_REALTIME_KINDS } from '@shared/constants/index.js';
import { buildBusinessSegmentState } from '@shared/utils/segments.js';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BusinessCatalogSection } from '@/components/business/BusinessCatalogSection.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { PublicSiteLayout } from '@/components/layout/PublicSiteLayout.jsx';
import { useAnalytics } from '@/hooks/useAnalytics.js';
import { useBusinessSite } from '@/hooks/useBusinessSite.js';
import {
  cancelPublicOrderPayment,
  createPublicOrder,
  getPublicOrderPayment,
  invalidatePublicSiteCache,
} from '@/services/publicSiteService.js';
import { subscribeToTenantUpdates } from '@/services/tenantRealtimeService.js';
import { useTenantTheme } from '@/hooks/useTenantTheme.js';
import { useTenant } from '@/context/TenantContext.jsx';

const PUBLIC_CATALOG_REFRESH_KINDS = new Set([
  TENANT_REALTIME_KINDS.TENANT_CREATED,
  TENANT_REALTIME_KINDS.TENANT_UPDATED,
  TENANT_REALTIME_KINDS.TENANT_STATUS_UPDATED,
  TENANT_REALTIME_KINDS.TENANT_DELETED,
  TENANT_REALTIME_KINDS.PRODUCT_CREATED,
  TENANT_REALTIME_KINDS.PRODUCT_UPDATED,
  TENANT_REALTIME_KINDS.PRODUCT_DELETED,
]);

function TenantLoadingScreen() {
  return (
    <div className="site-loading-screen" role="status" aria-live="polite">
      <div className="site-loading-screen__pulse" aria-hidden="true" />
      <strong>Carregando catálogo</strong>
      <span>Preparando os produtos e o carrinho deste tenant.</span>
    </div>
  );
}

function getPublicErrorContent(error) {
  if (error?.code === 'business_inactive') {
    return {
      title: 'Este site está temporariamente indisponível',
      description: 'Tente novamente mais tarde.',
    };
  }

  if (error?.status === 404) {
    return {
      title: 'Não foi possível carregar este tenant',
      description: error?.message || 'Negócio não encontrado.',
    };
  }

  return {
    title: 'Não foi possível carregar o catálogo',
    description: error?.message || 'Verifique a conexão com a API e tente novamente.',
  };
}

function buildBackHref(slug, search) {
  return `/site/${slug}${search || ''}`;
}

function BackToLandingButton({ slug, search, navigate }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="catalog-page-back-button"
      aria-label="Voltar para a página inicial"
      onClick={() => navigate(buildBackHref(slug, search))}
    >
      <svg
        className="catalog-page-back-button__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M15 18l-6-6 6-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </Button>
  );
}

export function PublicCatalogPage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setSite } = useTenant();
  const previewQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);

    return {
      preview: params.get('preview') === '1',
      cacheBust: params.get('t') || '',
      previewToken: params.get('previewToken') || '',
    };
  }, [location.search]);
  const { status, data: site, error, reload } = useBusinessSite(slug, previewQuery);
  const { trackAction, trackPageView } = useAnalytics(site);
  const trackedSlugRef = useRef('');
  const segmentState = useMemo(() => buildBusinessSegmentState(site?.business || {}), [site?.business]);
  const catalogProducts = site?.modulesData?.products || [];

  useTenantTheme(site?.theme);

  useEffect(() => {
    if (!site) {
      return;
    }

    setSite(site);

    if (trackedSlugRef.current !== `${site.business.slug}:catalog`) {
      trackedSlugRef.current = `${site.business.slug}:catalog`;
      trackPageView();
    }

    document.title = `${site.business.name} | Catálogo`;
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
        if (payload?.kind && !PUBLIC_CATALOG_REFRESH_KINDS.has(payload.kind)) {
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

        if (previewQuery.preview) {
          return;
        }

        if (payload?.slug && payload.slug !== slug) {
          navigate(`/site/${payload.slug}/catalog${location.search || ''}`, { replace: true });
          return;
        }

        reload({
          preview: previewQuery.preview,
          bypassCache: true,
          cacheBust: String(Date.now()),
          previewToken: previewQuery.previewToken,
        });
      },
    });
  }, [location.search, navigate, previewQuery.preview, previewQuery.previewToken, reload, site?.business?.id, slug]);

  const handleOrder = useCallback(async (payload) => {
    if (!site?.business?.slug) {
      throw new Error('Não foi possível identificar este tenant para concluir o pedido.');
    }

    return createPublicOrder(site.business.slug, payload);
  }, [site?.business?.slug]);

  const handleRecoverPendingPixOrder = useCallback(async (checkoutToken) => {
    if (!site?.business?.slug) {
      throw new Error('Não foi possível identificar este tenant para retomar o pagamento.');
    }

    return getPublicOrderPayment(site.business.slug, checkoutToken);
  }, [site?.business?.slug]);

  const handleCancelPendingPixOrder = useCallback(async (checkoutToken) => {
    if (!site?.business?.slug) {
      throw new Error('NÃ£o foi possÃ­vel identificar este tenant para cancelar o pagamento.');
    }

    return cancelPublicOrderPayment(site.business.slug, checkoutToken);
  }, [site?.business?.slug]);

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

  if (!(segmentState.modules.catalog || segmentState.modules.cart || segmentState.modules.orders)) {
    return (
      <PublicSiteLayout business={site.business}>
        <BackToLandingButton slug={site.business.slug} search={location.search} navigate={navigate} />
        <Card className="section-card">
          <EmptyState title="Catálogo indisponível no momento" description="Este tenant não está com o catálogo liberado agora." />
        </Card>
      </PublicSiteLayout>
    );
  }

  return (
    <PublicSiteLayout business={site.business}>
      <BackToLandingButton slug={site.business.slug} search={location.search} navigate={navigate} />
      <Card className="section-card catalog-page-shell catalog-page-hero">
        <div className="catalog-page-header">
          <div className="catalog-page-header__content">
            <span className="admin-section-chip admin-section-chip--muted">Catálogo</span>
            <h1>{site.business.name}</h1>
            <p>{site.business.description || 'Confira os produtos e faça seu pedido online.'}</p>
          </div>
          <div className="catalog-page-header__meta">
            <div>
              <span>Produtos</span>
              <strong>{catalogProducts.length}</strong>
            </div>
            <div>
              <span>Pedido online</span>
              <strong>{segmentState.modules.orders ? 'Ativo' : 'Consulta'}</strong>
            </div>
          </div>
        </div>
      </Card>

      <BusinessCatalogSection
        business={site.business}
        tenantSlug={site.business.slug}
        modules={segmentState.modules}
        segmentConfig={segmentState.segmentConfig}
        products={catalogProducts}
        onSubmitOrder={handleOrder}
        onRecoverPendingPixOrder={handleRecoverPendingPixOrder}
        onCancelPendingPixOrder={handleCancelPendingPixOrder}
        onTrackAction={trackAction}
      />
    </PublicSiteLayout>
  );
}
