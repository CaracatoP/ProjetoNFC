import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantProvider } from '@/context/TenantContext.jsx';
import { PublicCatalogPage } from './PublicCatalogPage.jsx';
import * as publicSiteService from '@/services/publicSiteService.js';
import * as analyticsService from '@/services/analyticsService.js';
import * as tenantRealtimeService from '@/services/tenantRealtimeService.js';

vi.mock('@/services/publicSiteService.js', () => ({
  getPublicSiteBySlug: vi.fn(),
  resolveNfcTag: vi.fn(),
  createPublicAppointmentRequest: vi.fn(),
  createPublicOrder: vi.fn(),
  getPublicOrderPayment: vi.fn(),
  invalidatePublicSiteCache: vi.fn(),
}));
vi.mock('@/services/analyticsService.js', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('@/services/tenantRealtimeService.js', () => ({
  subscribeToTenantUpdates: vi.fn(),
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
      description: 'Catálogo público',
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
    description: 'Catálogo público',
    imageUrl: '',
  },
};

describe('PublicCatalogPage', () => {
  let realtimeCallbacks;

  beforeEach(() => {
    publicSiteService.getPublicSiteBySlug.mockReset();
    publicSiteService.createPublicOrder?.mockReset();
    publicSiteService.createPublicOrder?.mockResolvedValue({
      id: 'order-public-catalog-1',
      status: 'received',
      total: 59.9,
      payment: {
        method: 'cash_on_pickup',
        status: 'manual',
        provider: 'manual',
        amount: 59.9,
      },
    });
    publicSiteService.getPublicOrderPayment?.mockReset();
    publicSiteService.invalidatePublicSiteCache?.mockReset();
    analyticsService.trackEvent.mockReset();
    tenantRealtimeService.subscribeToTenantUpdates.mockReset();
    tenantRealtimeService.subscribeToTenantUpdates.mockImplementation((_target, callbacks = {}) => {
      realtimeCallbacks = callbacks;
      return vi.fn();
    });
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

    expect(await screen.findByText('Catálogo indisponível no momento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Voltar para a página inicial/i })).toHaveClass('catalog-page-back-button');
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
    expect(screen.queryByText(/Voltar para a página principal/i)).not.toBeInTheDocument();
    const backButton = screen.getByRole('button', { name: /Voltar para a página inicial/i });
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
    await screen.findByRole('button', { name: /Voltar para a página inicial/i });
    expect(analyticsService.trackEvent).not.toHaveBeenCalled();
  });

  it('reloads the dedicated catalog immediately when a product availability update arrives for the same tenant', async () => {
    publicSiteService.getPublicSiteBySlug
      .mockResolvedValueOnce(baseFixture)
      .mockResolvedValueOnce({
        ...baseFixture,
        modulesData: {
          products: [
            {
              ...baseFixture.modulesData.products[0],
              isAvailable: false,
            },
          ],
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

    expect(await screen.findByRole('heading', { name: 'Acougue Central' })).toBeInTheDocument();
    expect(tenantRealtimeService.subscribeToTenantUpdates).toHaveBeenCalledWith(
      { businessId: 'business-1' },
      expect.any(Object),
    );

    const productCard = screen.getByText('Picanha').closest('.catalog-card');
    expect(within(productCard).getByRole('button', { name: 'Adicionar' })).toBeEnabled();

    await act(async () => {
      realtimeCallbacks?.onTenantUpdated?.({
        businessId: 'business-1',
        slug: 'acougue-central',
        kind: 'product_updated',
        operation: 'updated',
      });
    });

    expect(await screen.findByRole('button', { name: 'Indisponível' })).toBeDisabled();
    expect(screen.getAllByText('Indisponível').length).toBeGreaterThan(0);
    expect(publicSiteService.invalidatePublicSiteCache).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'acougue-central',
      }),
    );
    await waitFor(() => {
      expect(publicSiteService.getPublicSiteBySlug.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(publicSiteService.getPublicSiteBySlug).toHaveBeenLastCalledWith(
      'acougue-central',
      expect.objectContaining({
        bypassCache: true,
        cacheBust: expect.any(String),
      }),
    );
  });

  it('ignores realtime events that do not affect the dedicated catalog payload', async () => {
    publicSiteService.getPublicSiteBySlug.mockResolvedValue(baseFixture);

    render(
      <TenantProvider>
        <MemoryRouter initialEntries={['/site/acougue-central/catalog']}>
          <Routes>
            <Route path="/site/:slug/catalog" element={<PublicCatalogPage />} />
          </Routes>
        </MemoryRouter>
      </TenantProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Acougue Central' })).toBeInTheDocument();

    await act(async () => {
      realtimeCallbacks?.onTenantUpdated?.({
        businessId: 'business-1',
        slug: 'acougue-central',
        kind: 'order_created',
        operation: 'created',
      });
    });

    expect(publicSiteService.invalidatePublicSiteCache).not.toHaveBeenCalled();
    expect(publicSiteService.getPublicSiteBySlug).toHaveBeenCalledTimes(1);
  });
});
