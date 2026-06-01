import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantProvider } from '@/context/TenantContext.jsx';
import { PublicCatalogPage } from './PublicCatalogPage.jsx';
import * as publicSiteService from '@/services/publicSiteService.js';
import * as analyticsService from '@/services/analyticsService.js';

vi.mock('@/services/publicSiteService.js', () => ({
  getPublicSiteBySlug: vi.fn(),
  resolveNfcTag: vi.fn(),
  createPublicAppointmentRequest: vi.fn(),
  createPublicOrder: vi.fn(),
  invalidatePublicSiteCache: vi.fn(),
}));
vi.mock('@/services/analyticsService.js', () => ({
  trackEvent: vi.fn(),
}));

const baseFixture = {
  business: {
    id: 'business-1',
    slug: 'acougue-central',
    name: 'Acougue Central',
    description: 'Carnes especiais e cortes frescos.',
    logoUrl: '',
    bannerUrl: '',
    badge: 'Acougue Central',
    status: 'active',
    seo: {
      title: 'Acougue Central',
      description: 'Catalogo publico',
      imageUrl: '',
    },
    segment: 'butcher',
    modules: {
      catalog: true,
      appointments: false,
      cart: true,
      orders: true,
      loyalty: false,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Carnes e utilitarios',
      catalogDescription: 'Escolha os itens do pedido.',
    },
  },
  theme: {
    colors: {
      primary: '#b91c1c',
      secondary: '#7f1d1d',
      background: '#140d09',
      surface: '#211410',
      surfaceAlt: '#2b1d16',
      text: '#fff8f2',
      textMuted: '#f4d5c3',
      border: 'rgba(255,255,255,.12)',
      success: '#22c55e',
      danger: '#ef4444',
      accent: 'rgba(185,28,28,.18)',
    },
  },
  sections: [],
  links: [],
  modulesData: {
    products: [
      {
        id: 'product-1',
        name: 'Picanha',
        description: 'Corte bovino nobre',
        price: 59.9,
        image: '',
        category: 'Carnes',
        measurementUnit: 'kg',
        active: true,
      },
    ],
  },
  seo: {
    title: 'Acougue Central',
    description: 'Catalogo publico',
    imageUrl: '',
  },
};

describe('PublicCatalogPage', () => {
  beforeEach(() => {
    publicSiteService.getPublicSiteBySlug.mockReset();
    publicSiteService.createPublicOrder?.mockReset();
    publicSiteService.createPublicOrder?.mockResolvedValue({ status: 'received' });
    analyticsService.trackEvent.mockReset();
  });

  it('shows a friendly unavailable state when the catalog modules are disabled', async () => {
    publicSiteService.getPublicSiteBySlug.mockResolvedValue({
      ...baseFixture,
      business: {
        ...baseFixture.business,
        modules: {
          ...baseFixture.business.modules,
          catalog: false,
          cart: false,
          orders: false,
        },
      },
      modulesData: {
        products: [],
      },
    });

    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/acougue-central/catalog']}>
          <Routes>
            <Route path="/site/:slug/catalog" element={<PublicCatalogPage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByText('Catalogo indisponivel no momento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Voltar para a pagina inicial/i })).toHaveClass('catalog-page-back-button');
  });

  it('shows a friendly empty state when there are no products yet', async () => {
    publicSiteService.getPublicSiteBySlug.mockResolvedValue({
      ...baseFixture,
      modulesData: {
        products: [],
      },
    });

    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/acougue-central/catalog']}>
          <Routes>
            <Route path="/site/:slug/catalog" element={<PublicCatalogPage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByText('Nenhum produto cadastrado ainda')).toBeInTheDocument();
  });

  it('returns to the landing page while preserving preview query params', async () => {
    const user = userEvent.setup();

    publicSiteService.getPublicSiteBySlug.mockResolvedValue(baseFixture);

    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/acougue-central/catalog?preview=1&t=1700000000000']}>
          <Routes>
            <Route path="/site/:slug" element={<div>Landing limpa</div>} />
            <Route path="/site/:slug/catalog" element={<PublicCatalogPage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Acougue Central' })).toBeInTheDocument();
    expect(screen.queryByText(/Voltar para a pagina principal/i)).not.toBeInTheDocument();
    const backButton = screen.getByRole('button', { name: /Voltar para a pagina inicial/i });
    expect(backButton).toHaveClass('catalog-page-back-button');
    await user.click(backButton);
    expect(await screen.findByText('Landing limpa')).toBeInTheDocument();
  });

  it('does not track analytics in authorized preview mode on the catalog page', async () => {
    publicSiteService.getPublicSiteBySlug.mockResolvedValue({
      ...baseFixture,
      previewContext: {
        requested: true,
        authorized: true,
      },
    });

    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/acougue-central/catalog?preview=1&t=1700000000000&previewToken=preview-token-1']}>
          <Routes>
            <Route path="/site/:slug/catalog" element={<PublicCatalogPage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Acougue Central' })).toBeInTheDocument();
    await screen.findByRole('button', { name: /Voltar para a pagina inicial/i });
    expect(analyticsService.trackEvent).not.toHaveBeenCalled();
  });
});
