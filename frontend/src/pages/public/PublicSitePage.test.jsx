import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { TenantProvider } from '@/context/TenantContext.jsx';
import { PublicSitePage } from './PublicSitePage.jsx';
import * as publicSiteService from '@/services/publicSiteService.js';
import * as analyticsService from '@/services/analyticsService.js';
import * as tenantRealtimeService from '@/services/tenantRealtimeService.js';

vi.mock('@/services/publicSiteService.js', () => ({
  getPublicSiteBySlug: vi.fn(),
  resolveNfcTag: vi.fn(),
}));
vi.mock('@/services/analyticsService.js', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('@/services/tenantRealtimeService.js', () => ({
  subscribeToTenantUpdates: vi.fn(),
}));

const siteFixture = {
  business: {
    id: 'business-1',
    slug: 'barbearia-estilo-vivo',
    name: 'Barbearia Estilo Vivo',
    description: 'Experiencia premium.',
    logoUrl: 'https://cdn.example.com/logo.png',
    bannerUrl: 'https://cdn.example.com/banner.png',
    badge: 'Barbearia Estilo Vivo',
    status: 'active',
    address: { display: 'Av. Paulista, 1000' },
    hours: [{ id: 'weekday', label: 'Seg-Sex', value: '09:00 - 18:00' }],
    contact: {
      pix: {
        key: '12345678900',
        keyType: 'cpf',
        receiverName: 'Barbearia Estilo Vivo',
        city: 'Sao Paulo',
        description: 'PIX instantaneo',
      },
      wifi: {
        ssid: 'WiFi',
        password: 'Senha123',
        security: 'WPA',
      },
    },
    seo: {
      title: 'Barbearia Estilo Vivo',
      description: 'Pagina publica',
      imageUrl: 'https://cdn.example.com/favicon.png',
    },
  },
  theme: {
    colors: {
      primary: '#f97316',
      secondary: '#fb7185',
      background: '#140d09',
      surface: '#211410',
      surfaceAlt: '#2b1d16',
      text: '#fff8f2',
      textMuted: '#f4d5c3',
      border: 'rgba(255,255,255,.12)',
      success: '#22c55e',
      danger: '#ef4444',
      accent: 'rgba(249,115,22,.18)',
    },
    typography: {
      headingFamily: "'Space Grotesk', sans-serif",
      bodyFamily: "'Manrope', sans-serif",
      baseSize: '16px',
      heroSize: '4rem',
      sectionTitleSize: '2rem',
    },
    spacing: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px' },
    radius: { sm: '8px', md: '16px', lg: '24px', pill: '999px' },
    layout: { maxWidth: '1180px', pagePadding: '24px', sectionGap: '24px', cardGap: '16px' },
    buttons: {
      primary: { background: 'linear-gradient(135deg, #f97316, #fb7185)', color: '#fff', border: 'none' },
      secondary: { background: '#211410', color: '#fff8f2', border: '1px solid rgba(255,255,255,.12)' },
    },
  },
  sections: [
    {
      id: 'hero-1',
      key: 'hero-main',
      type: 'hero',
      title: 'Barbearia Estilo Vivo',
      description: 'Descricao antiga da secao.',
      order: 10,
      visible: true,
      settings: {
        badge: 'Badge antigo',
        rating: '4.8/5.0',
        address: 'Av. Paulista, 1000',
        hours: [{ id: 'weekday', label: 'Seg-Sex', value: '09:00 - 18:00' }],
      },
      items: [],
    },
    {
      id: 'links-1',
      key: 'quick-actions',
      type: 'links',
      title: 'Acesso rapido',
      description: 'Atalhos rapidos',
      order: 20,
      visible: true,
      settings: { layout: 'compact' },
      items: [
        {
          id: 'link-hours',
          type: 'contact',
          label: 'Ver horarios',
          subtitle: 'Confira atendimento e endereco',
          metadata: { action: 'contact', targetSection: 'contact' },
        },
        {
          id: 'link-wifi',
          type: 'wifi',
          label: 'Wi-Fi',
          subtitle: 'Abrir senha e QR Code',
          metadata: { action: 'wifi' },
        },
        {
          id: 'link-instagram',
          type: 'social',
          label: 'Instagram',
          subtitle: 'Acompanhe novidades',
          icon: 'instagram',
          url: 'https://instagram.com/estilovivo',
          target: '_blank',
        },
      ],
    },
    {
      id: 'services-1',
      key: 'services',
      type: 'services',
      title: 'Servicos',
      description: 'Catalogo',
      order: 30,
      visible: true,
      settings: {},
      items: [
        {
          id: 'service-1',
          name: 'Corte masculino',
          price: 45,
          description: 'Classico',
          imageUrl: 'https://cdn.example.com/service.jpg',
        },
      ],
    },
    {
      id: 'hidden-1',
      key: 'hidden',
      type: 'custom',
      title: 'Oculta',
      description: 'Nao deveria aparecer',
      order: 40,
      visible: false,
      settings: {},
      items: [],
    },
    {
      id: 'cta-1',
      key: 'cta',
      type: 'cta',
      title: 'Fale com nossa equipe',
      description: 'Canal configurado pelo tenant.',
      order: 60,
      visible: true,
      settings: {
        eyebrow: 'Contato final',
        primaryAction: {
          label: 'Abrir Instagram',
          href: 'https://instagram.com/tenant-oficial',
        },
      },
      items: [],
    },
  ],
  links: [],
  seo: {
    title: 'Barbearia Estilo Vivo',
    description: 'Pagina publica',
    imageUrl: 'https://cdn.example.com/favicon.png',
  },
};

describe('PublicSitePage', () => {
  let realtimeCallbacks;

  beforeEach(() => {
    publicSiteService.getPublicSiteBySlug.mockResolvedValue(siteFixture);
    analyticsService.trackEvent.mockClear();
    tenantRealtimeService.subscribeToTenantUpdates.mockImplementation((_target, callbacks = {}) => {
      realtimeCallbacks = callbacks;
      return vi.fn();
    });
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders dynamic sections, applies favicon and tracks interactions', async () => {
    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/barbearia-estilo-vivo']}>
          <Routes>
            <Route path="/site/:slug" element={<PublicSitePage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Barbearia Estilo Vivo' })).toBeInTheDocument();
    expect(screen.getAllByText('Barbearia Estilo Vivo')).toHaveLength(1);
    expect(screen.getByText('Servicos')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Corte masculino' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/service.jpg',
    );
    expect(screen.getByText('Experiencia premium.')).toBeInTheDocument();
    expect(screen.getByText('Fale com nossa equipe')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir Instagram/i })).toHaveAttribute(
      'href',
      'https://instagram.com/tenant-oficial',
    );
    expect(screen.getByRole('button', { name: /Wi-Fi/i })).toBeInTheDocument();
    expect(screen.getByText('Instagram').closest('a')).toHaveAttribute(
      'href',
      'https://instagram.com/estilovivo',
    );
    expect(document.querySelector("link[rel='icon']")?.getAttribute('href')).toBe(
      'https://cdn.example.com/favicon.png',
    );
    expect(document.querySelector("link[rel='alternate icon']")?.getAttribute('href')).toBe(
      'https://cdn.example.com/favicon.png',
    );
    expect(document.querySelector("link[rel='shortcut icon']")?.getAttribute('href')).toBe(
      'https://cdn.example.com/favicon.png',
    );
    expect(screen.queryByText('Descricao antiga da secao.')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Logo Barbearia Estilo Vivo/i })).toBeInTheDocument();
    expect(screen.queryByText('Oculta')).not.toBeInTheDocument();
    expect(screen.queryByText('Ver horarios')).not.toBeInTheDocument();

    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'page_view',
        slug: 'barbearia-estilo-vivo',
      }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#f97316');
    });
  });

  it('shows a neutral message when the tenant is inactive', async () => {
    publicSiteService.getPublicSiteBySlug.mockRejectedValueOnce({
      status: 423,
      code: 'business_inactive',
      message: 'Este site esta temporariamente indisponivel.',
    });

    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/barbearia-estilo-vivo']}>
          <Routes>
            <Route path="/site/:slug" element={<PublicSitePage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByText('Este site esta temporariamente indisponivel')).toBeInTheDocument();
    expect(screen.getByText('Tente novamente mais tarde.')).toBeInTheDocument();
  });

  it('reloads the tenant when a realtime update arrives', async () => {
    publicSiteService.getPublicSiteBySlug
      .mockResolvedValueOnce(siteFixture)
      .mockResolvedValueOnce({
        ...siteFixture,
        business: {
          ...siteFixture.business,
          description: 'Experiencia atualizada em tempo real.',
        },
      });

    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/barbearia-estilo-vivo']}>
          <Routes>
            <Route path="/site/:slug" element={<PublicSitePage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByText('Experiencia premium.')).toBeInTheDocument();

    await act(async () => {
      realtimeCallbacks?.onTenantUpdated?.({
        businessId: 'business-1',
        slug: 'barbearia-estilo-vivo',
        operation: 'updated',
      });
    });

    expect(await screen.findByText('Experiencia atualizada em tempo real.')).toBeInTheDocument();
    await waitFor(() => {
      expect(publicSiteService.getPublicSiteBySlug.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
