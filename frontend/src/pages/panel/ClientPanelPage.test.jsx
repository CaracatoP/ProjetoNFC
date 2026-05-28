import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientPanelPage } from './ClientPanelPage.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import * as clientPanelService from '@/services/clientPanelService.js';

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/clientPanelService.js', () => ({
  fetchClientPanelBusiness: vi.fn(),
  updateClientPanelBusinessBasics: vi.fn(),
  fetchClientPanelAnalytics: vi.fn(),
  uploadClientPanelImage: vi.fn(),
  createClientPanelProduct: vi.fn(),
  updateClientPanelProduct: vi.fn(),
  deleteClientPanelProduct: vi.fn(),
  createClientPanelProfessional: vi.fn(),
  updateClientPanelProfessional: vi.fn(),
  deleteClientPanelProfessional: vi.fn(),
  createClientPanelAppointmentService: vi.fn(),
  updateClientPanelAppointmentService: vi.fn(),
  deleteClientPanelAppointmentService: vi.fn(),
  updateClientPanelOrderStatus: vi.fn(),
  updateClientPanelAppointmentRequestStatus: vi.fn(),
}));

const editorFixture = {
  business: {
    id: 'business-1',
    name: 'Barbearia Estilo Vivo',
    legalName: 'Barbearia Estilo Vivo LTDA',
    slug: 'barbearia-estilo-vivo',
    description: 'Experiencia premium',
    logoUrl: '',
    logoPublicId: '',
    bannerUrl: '',
    bannerPublicId: '',
    badge: 'Corte premium',
    status: 'active',
    publicUrl: 'https://taplinkapp.vercel.app/site/barbearia-estilo-vivo',
    rating: '4.9',
    segment: 'barbershop',
    modules: {
      catalog: true,
      appointments: true,
      cart: false,
      orders: true,
      loyalty: true,
      whatsapp: true,
      analytics: true,
    },
    segmentConfig: {
      label: 'Barbearia',
      description: 'Ideal para agenda, vitrine de servicos e relacionamento recorrente.',
    },
    domains: {
      subdomain: '',
      customDomain: '',
    },
    address: {
      display: 'Av. Paulista, 1000',
      mapUrl: '',
      embedUrl: '',
    },
    hours: [{ id: 'weekday', label: 'Seg-Sex', value: '09:00 - 19:00' }],
    contact: {
      whatsapp: '5511999999999',
      phone: '1130000000',
      email: 'contato@example.com',
    },
    seo: {
      title: 'Barbearia Estilo Vivo',
      description: 'Pagina publica da barbearia',
      imageUrl: '',
    },
  },
  theme: {},
  links: [],
  sections: [
    { id: 'section-cta', key: 'cta', type: 'cta', settings: { primaryAction: { href: 'https://example.com' } }, items: [] },
    { id: 'section-gallery', key: 'gallery', type: 'gallery', settings: {}, items: [] },
    { id: 'section-services', key: 'services', type: 'services', settings: {}, items: [] },
  ],
  modulesData: {
    professionals: [],
    appointmentServices: [],
    appointmentRequests: [],
    products: [],
    orders: [],
  },
};

describe('ClientPanelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    clientPanelService.fetchClientPanelBusiness.mockResolvedValue(editorFixture);
    clientPanelService.updateClientPanelBusinessBasics.mockResolvedValue(editorFixture);
    clientPanelService.fetchClientPanelAnalytics.mockResolvedValue({
      scope: 'advanced',
      totals: {
        totalEvents: 24,
        last7DaysEvents: 10,
        pageViews: 16,
      },
    });
  });

  it('shows a dedicated suspended state without fetching tenant content', async () => {
    const logout = vi.fn();
    useAuth.mockReturnValue({
      token: 'client-token',
      user: { displayName: 'Cliente', roleLevel: 2 },
      subscription: { plan: { name: 'Premium' } },
      access: { billingStatus: 'suspended', analyticsScope: 'none', capabilities: {} },
      isSuspendedClientAccess: true,
      logout,
    });

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Acesso temporariamente suspenso')).toBeInTheDocument();
    expect(clientPanelService.fetchClientPanelBusiness).not.toHaveBeenCalled();
  });

  it('loads the client panel and saves basic business settings for level 2', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      token: 'client-token',
      user: { displayName: 'Cliente Dono', roleLevel: 2 },
      subscription: { plan: { name: 'Premium' } },
      access: {
        billingStatus: 'paid',
        analyticsScope: 'advanced',
        capabilities: {
          canEditTenantBasics: true,
          canUploadMedia: true,
          canViewCatalog: true,
          canEditCatalog: true,
          canViewOrders: true,
          canManageOrders: true,
          canViewAppointments: true,
          canManageAppointments: true,
          canViewProfessionals: true,
          canEditProfessionals: true,
          canViewServices: true,
          canEditServices: true,
          canViewAnalytics: true,
        },
      },
      isSuspendedClientAccess: false,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Operacao do tenant')).toBeInTheDocument();
    expect(await screen.findByText('Dados publicos do negocio')).toBeInTheDocument();
    expect(await screen.findByText('Visao do tenant')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Nome do negocio');
    await user.clear(nameInput);
    await user.type(nameInput, 'Barbearia Cliente');
    await user.click(screen.getByRole('button', { name: /Salvar dados basicos/i }));

    await waitFor(() => {
      expect(clientPanelService.updateClientPanelBusinessBasics).toHaveBeenCalledWith(
        'client-token',
        expect.objectContaining({
          business: expect.objectContaining({
            name: 'Barbearia Cliente',
          }),
        }),
      );
    });
  });

  it('keeps the panel read-only for level 5 users', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      token: 'client-token',
      user: { displayName: 'Visualizador', roleLevel: 5 },
      subscription: { plan: { name: 'Pro' } },
      access: {
        billingStatus: 'paid',
        analyticsScope: 'none',
        capabilities: {
          canEditTenantBasics: false,
          canUploadMedia: false,
          canViewCatalog: true,
          canEditCatalog: false,
          canViewOrders: true,
          canManageOrders: false,
          canViewAppointments: true,
          canManageAppointments: false,
          canViewProfessionals: false,
          canEditProfessionals: false,
          canViewServices: false,
          canEditServices: false,
          canViewAnalytics: false,
        },
      },
      isSuspendedClientAccess: false,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Operacao do tenant')).toBeInTheDocument();
    expect(screen.queryByText('Dados publicos do negocio')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Catalogo/i }));
    expect(await screen.findByText(/pode visualizar o catalogo, mas nao editar produtos/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Profissionais/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Servicos/i })).not.toBeInTheDocument();
  });
});
