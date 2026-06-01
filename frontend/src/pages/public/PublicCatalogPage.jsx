import { useEffect, useMemo, useRef } from 'react';
import { buildBusinessSegmentState } from '@shared/utils/segments.js';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BusinessCatalogSection } from '@/components/business/BusinessCatalogSection.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { PublicSiteLayout } from '@/components/layout/PublicSiteLayout.jsx';
import { useAnalytics } from '@/hooks/useAnalytics.js';
import { useBusinessSite } from '@/hooks/useBusinessSite.js';
import { createPublicOrder } from '@/services/publicSiteService.js';
import { useTenantTheme } from '@/hooks/useTenantTheme.js';
import { useTenant } from '@/context/TenantContext.jsx';

function TenantLoadingScreen() {
  return (
    <div className="site-loading-screen" role="status" aria-live="polite">
      <div className="site-loading-screen__pulse" aria-hidden="true" />
      <strong>Carregando catalogo</strong>
      <span>Preparando os produtos e o carrinho deste tenant.</span>
    </div>
  );
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
    title: 'Nao foi possivel carregar o catalogo',
    description: error?.message || 'Verifique a conexao com a API e tente novamente.',
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
      aria-label="Voltar para a pagina inicial"
      onClick={() => navigate(buildBackHref(slug, search))}
    >
      ←
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
  const { status, data: site, error } = useBusinessSite(slug, previewQuery);
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

    document.title = `${site.business.name} | Catalogo`;
  }, [setSite, site, trackPageView]);

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

  if (!(segmentState.modules.catalog || segmentState.modules.cart || segmentState.modules.orders)) {
    return (
      <PublicSiteLayout business={site.business}>
        <BackToLandingButton slug={site.business.slug} search={location.search} navigate={navigate} />
        <Card className="section-card">
          <EmptyState title="Catalogo indisponivel no momento" description="Este tenant nao esta com o catalogo liberado agora." />
        </Card>
      </PublicSiteLayout>
    );
  }

  return (
    <PublicSiteLayout business={site.business}>
      <BackToLandingButton slug={site.business.slug} search={location.search} navigate={navigate} />
      <Card className="section-card catalog-page-shell">
        <div className="catalog-page-header">
          <div className="catalog-page-header__content">
            <span className="admin-section-chip admin-section-chip--muted">Catalogo</span>
            <h1>{site.business.name}</h1>
            <p>{site.business.description || 'Confira os produtos e faca seu pedido online.'}</p>
          </div>
        </div>
      </Card>

      {!catalogProducts.length ? (
        <Card className="section-card">
          <EmptyState title="Nenhum produto cadastrado ainda" description="Os produtos deste tenant aparecerao aqui assim que forem publicados." />
        </Card>
      ) : (
        <BusinessCatalogSection
          business={site.business}
          tenantSlug={site.business.slug}
          modules={segmentState.modules}
          segmentConfig={segmentState.segmentConfig}
          products={catalogProducts}
          onSubmitOrder={handleOrder}
          onTrackAction={trackAction}
        />
      )}
    </PublicSiteLayout>
  );
}
