import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BusinessPixModal } from '@/components/business/BusinessPixModal.jsx';
import { BusinessWifiModal } from '@/components/business/BusinessWifiModal.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { Button } from '@/components/common/Button.jsx';
import { PublicSiteLayout } from '@/components/layout/PublicSiteLayout.jsx';
import { SectionRenderer } from '@/components/business/SectionRenderer.jsx';
import { useAnalytics } from '@/hooks/useAnalytics.js';
import { useBusinessSite } from '@/hooks/useBusinessSite.js';
import { useTenantTheme } from '@/hooks/useTenantTheme.js';
import { useTenant } from '@/context/TenantContext.jsx';
import { getSectionAnchor } from '@/utils/sections.js';

export function PublicSitePage() {
  const { slug = '' } = useParams();
  const { status, data: site, error } = useBusinessSite(slug);
  const { setSite } = useTenant();
  const { trackAction, trackPageView } = useAnalytics(site);
  const trackedSlugRef = useRef('');
  const [activeModal, setActiveModal] = useState(null);

  useTenantTheme(site?.theme);

  useEffect(() => {
    if (site) {
      setSite(site);
      if (trackedSlugRef.current !== site.business.slug) {
        trackedSlugRef.current = site.business.slug;
        trackPageView();
      }
      document.title = site.seo.title;
    }
  }, [setSite, site, trackPageView]);

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
        <EmptyState title="Carregando página NFC" description="Buscando conteúdo dinâmico do tenant." />
      </PublicSiteLayout>
    );
  }

  if (status === 'error') {
    return (
      <PublicSiteLayout business={{ slug: slug || 'erro', status: 'error' }}>
        <EmptyState
          title="Não foi possível carregar este tenant"
          description={error?.message || 'Verifique a conexão com a API e tente novamente.'}
          action={<Button href="/">Voltar para a home</Button>}
        />
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
        onTrackAction={trackAction}
      />
    </PublicSiteLayout>
  );
}
