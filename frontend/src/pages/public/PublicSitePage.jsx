import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BusinessPixModal } from '@/components/business/BusinessPixModal.jsx';
import { BusinessWifiModal } from '@/components/business/BusinessWifiModal.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { PublicSiteLayout } from '@/components/layout/PublicSiteLayout.jsx';
import { SectionRenderer } from '@/components/business/SectionRenderer.jsx';
import { useAnalytics } from '@/hooks/useAnalytics.js';
import { useBusinessSite } from '@/hooks/useBusinessSite.js';
import { subscribeToTenantUpdates } from '@/services/tenantRealtimeService.js';
import { useTenantTheme } from '@/hooks/useTenantTheme.js';
import { useTenant } from '@/context/TenantContext.jsx';
import { getSectionAnchor } from '@/utils/sections.js';

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

export function PublicSitePage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { status, data: site, error, reload } = useBusinessSite(slug);
  const { setSite } = useTenant();
  const { trackAction, trackPageView } = useAnalytics(site);
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
        if (payload?.slug && payload.slug !== slug) {
          navigate(`/site/${payload.slug}`, { replace: true });
          return;
        }

        reload();
      },
    });
  }, [navigate, reload, site?.business?.id, slug]);

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

  if (status === 'loading' || status === 'idle') {
    return (
      <PublicSiteLayout business={{ slug: slug || 'carregando', status: 'loading' }}>
        <EmptyState title="Carregando pagina NFC" description="Buscando conteudo dinamico do tenant." />
      </PublicSiteLayout>
    );
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
