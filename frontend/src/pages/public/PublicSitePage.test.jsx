import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantProvider } from '@/context/TenantContext.jsx';
import { PublicSitePage } from './PublicSitePage.jsx';
import * as publicSiteService from '@/services/publicSiteService.js';
import * as analyticsService from '@/services/analyticsService.js';

vi.mock('@/services/publicSiteService.js', () => ({
  getPublicSiteBySlug: vi.fn(),
  resolveNfcTag: vi.fn(),
}));
vi.mock('@/services/analyticsService.js', () => ({
  trackEvent: vi.fn(),
}));

const siteFixture = {
  business: {
    id: 'business-1',
    slug: 'barbearia-estilo-vivo',
    name: 'Barbearia Estilo Vivo',
    description: 'Experiencia premium.',
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
      description: 'Experiencia premium.',
      order: 10,
      visible: true,
      settings: {
        badge: 'Landing Page NFC',
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
        { id: 'link-1', type: 'wifi', label: 'Abrir Wi-Fi', subtitle: 'Senha e QR', metadata: { action: 'wifi' } },
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
      items: [{ id: 'service-1', name: 'Corte masculino', price: 45, description: 'Classico' }],
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
      id: 'wifi-1',
      key: 'wifi',
      type: 'wifi',
      title: 'Wi-Fi do local',
      description: 'Conecte-se',
      order: 50,
      visible: true,
      settings: { ssid: 'WiFi', password: 'Senha123', security: 'WPA', displayMode: 'modal' },
      items: [],
    },
  ],
  links: [],
  seo: {
    title: 'Barbearia Estilo Vivo',
    description: 'Pagina publica',
  },
};

describe('PublicSitePage', () => {
  beforeEach(() => {
    publicSiteService.getPublicSiteBySlug.mockResolvedValue(siteFixture);
    analyticsService.trackEvent.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders dynamic sections, hides support shortcuts in compact actions and tracks interactions', async () => {
    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/barbearia-estilo-vivo']}>
          <Routes>
            <Route path="/site/:slug" element={<PublicSitePage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByText('Barbearia Estilo Vivo')).toBeInTheDocument();
    expect(screen.getByText('Servicos')).toBeInTheDocument();
    expect(screen.queryByText('Oculta')).not.toBeInTheDocument();
    expect(screen.queryByText('Ver horarios')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#f97316');
    });

    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'page_view',
        slug: 'barbearia-estilo-vivo',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Abrir Wi-Fi/i }));

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: /Wi-Fi/i })).toBeInTheDocument();
    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'link_click',
        sectionType: 'links',
      }),
    );
  });
});
