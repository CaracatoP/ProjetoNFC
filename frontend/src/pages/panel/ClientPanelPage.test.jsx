import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientPanelPage } from './ClientPanelPage.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import * as clientPanelService from '@/services/clientPanelService.js';
import * as tenantRealtimeService from '@/services/tenantRealtimeService.js';

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
  updateClientPanelOrderPaymentStatus: vi.fn(),
  deleteClientPanelOrder: vi.fn(),
  updateClientPanelAppointmentRequestStatus: vi.fn(),
}));

vi.mock('@/services/tenantRealtimeService.js', () => ({
  subscribeToTenantUpdates: vi.fn(),
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
      pix: {
        keyType: 'email',
        key: 'pix@cliente.local',
        receiverName: 'Barbearia Estilo Vivo',
        city: 'Sao Paulo',
      },
    },
    paymentSettings: {
      enabled: true,
      methods: {
        pix: true,
        creditCard: false,
        debitCard: false,
        cashOnPickup: true,
        cashOnDelivery: true,
      },
      pix: {
        key: 'pix@cliente.local',
        merchantName: 'Barbearia Estilo Vivo',
        merchantCity: 'Sao Paulo',
      },
      provider: 'manual',
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
  let realtimeCallbacks;
  let realtimeCleanup;

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeCallbacks = {};
    realtimeCleanup = vi.fn();

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
    tenantRealtimeService.subscribeToTenantUpdates.mockImplementation((_target, callbacks = {}) => {
      realtimeCallbacks = callbacks;
      return realtimeCleanup;
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
            paymentSettings: expect.objectContaining({
              enabled: true,
            }),
          }),
        }),
      );
    });
  });

  it('lets the tenant owner configure manual Pix and mark manual payments as paid from the panel', async () => {
    const user = userEvent.setup();
    const editorWithOrders = {
      ...editorFixture,
      modulesData: {
        ...editorFixture.modulesData,
        orders: [
          {
            id: 'order-1',
            customerName: 'Carlos',
            customerPhone: '5511999999999',
            deliveryType: 'pickup',
            total: 79.8,
            status: 'received',
            payment: {
              method: 'pix',
              status: 'pending',
              provider: 'manual',
              amount: 79.8,
              pixCopyPaste: 'pix-code',
            },
            items: [{ name: 'Pomada', quantity: 2, unitPrice: 39.9, measurementUnit: 'unit', itemTotal: 79.8 }],
            notes: '',
          },
        ],
      },
    };

    clientPanelService.fetchClientPanelBusiness.mockResolvedValueOnce({
      ...editorWithOrders,
    });
    clientPanelService.updateClientPanelBusinessBasics.mockResolvedValue(editorWithOrders);
    clientPanelService.updateClientPanelOrderPaymentStatus.mockResolvedValue({
      id: 'order-1',
      payment: {
        method: 'pix',
        status: 'paid',
        provider: 'manual',
        amount: 79.8,
      },
    });
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

    await user.clear(screen.getByLabelText('Chave Pix'));
    await user.type(screen.getByLabelText('Chave Pix'), 'novo-pix@cliente.local');
    await user.click(screen.getByRole('button', { name: /Salvar dados basicos/i }));

    await waitFor(() => {
      expect(clientPanelService.updateClientPanelBusinessBasics).toHaveBeenCalledWith(
        'client-token',
        expect.objectContaining({
          business: expect.objectContaining({
            paymentSettings: expect.objectContaining({
              methods: expect.objectContaining({
                pix: true,
              }),
              pix: expect.objectContaining({
                key: 'novo-pix@cliente.local',
              }),
            }),
            contact: expect.objectContaining({
              pix: expect.objectContaining({
                key: 'novo-pix@cliente.local',
              }),
            }),
          }),
        }),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Pedidos' }));
    const receivedOrderCard = await screen.findByTestId('order-card-received');
    expect(within(receivedOrderCard).getByText('Pix')).toBeInTheDocument();
    expect(within(receivedOrderCard).getByText('Pendente')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Marcar pagamento como pago/i }));

    await waitFor(() => {
      expect(clientPanelService.updateClientPanelOrderPaymentStatus).toHaveBeenCalledWith(
        'client-token',
        'order-1',
        'paid',
      );
    });
  });

  it('lets client mode minimize and expand the basic settings card', async () => {
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

    expect(await screen.findByText('Dados publicos do negocio')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do negocio')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Minimizar configuracoes basicas/i }));

    expect(screen.queryByLabelText('Nome do negocio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expandir configuracoes basicas/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Expandir configuracoes basicas/i }));

    expect(screen.getByLabelText('Nome do negocio')).toBeInTheDocument();
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

  it('shows an upgrade message when the tenant plan does not include analytics yet', async () => {
    useAuth.mockReturnValue({
      token: 'client-token',
      user: { displayName: 'Cliente Dono', roleLevel: 2 },
      subscription: { plan: { name: 'Starter', code: 'starter' } },
      access: {
        billingStatus: 'paid',
        analyticsScope: 'none',
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
    expect(await screen.findByText('Analytics indisponivel no plano atual')).toBeInTheDocument();
    expect(screen.getAllByText(/Starter/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Eventos recentes')).not.toBeInTheDocument();
  });

  it('refreshes the session after plan updates and reloads analytics with the new scope', async () => {
    let forceAuthRerender = () => {};
    const authState = {
      token: 'client-token',
      user: { displayName: 'Cliente Dono', roleLevel: 2 },
      subscription: { plan: { name: 'Starter' } },
      access: {
        billingStatus: 'paid',
        analyticsScope: 'none',
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
          canViewAnalytics: false,
        },
      },
      isSuspendedClientAccess: false,
      logout: vi.fn(),
      refreshSession: vi.fn(async () => {
        authState.subscription = { plan: { name: 'Premium' } };
        authState.access = {
          billingStatus: 'paid',
          analyticsScope: 'advanced',
          capabilities: {
            ...authState.access.capabilities,
            canViewAnalytics: true,
          },
        };
        forceAuthRerender();
        return {
          user: authState.user,
          subscription: authState.subscription,
          access: authState.access,
        };
      }),
    };

    useAuth.mockImplementation(() => authState);
    clientPanelService.fetchClientPanelAnalytics.mockResolvedValue({
      scope: 'advanced',
      totals: {
        totalEvents: 42,
        last7DaysEvents: 11,
        pageViews: 27,
      },
    });

    function AuthRerenderHarness() {
      const [, setVersion] = useState(0);

      useEffect(() => {
        forceAuthRerender = () => setVersion((current) => current + 1);
        return () => {
          forceAuthRerender = () => {};
        };
      }, []);

      return <ClientPanelPage />;
    }

    render(
      <MemoryRouter>
        <AuthRerenderHarness />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Operacao do tenant')).toBeInTheDocument();
    expect(screen.getAllByText('Sem analytics').length).toBeGreaterThan(0);
    expect(screen.getByText('Analytics indisponivel no plano atual')).toBeInTheDocument();

    await waitFor(() => {
      expect(tenantRealtimeService.subscribeToTenantUpdates).toHaveBeenCalledWith(
        {
          businessId: 'business-1',
          slug: 'barbearia-estilo-vivo',
        },
        expect.objectContaining({
          onTenantUpdated: expect.any(Function),
        }),
      );
    });

    await act(async () => {
      await realtimeCallbacks.onTenantUpdated?.({
        businessId: 'business-1',
        kind: 'plan_updated',
        emittedAt: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(authState.refreshSession).toHaveBeenCalledTimes(1);
      expect(clientPanelService.fetchClientPanelBusiness).toHaveBeenCalledTimes(2);
      expect(clientPanelService.fetchClientPanelAnalytics).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Visao do tenant')).toBeInTheDocument();
      expect(screen.getAllByText('Avancado').length).toBeGreaterThan(0);
    });
  });

  it('refetches the tenant after realtime updates without discarding unsaved basic edits and cleans up on unmount', async () => {
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

    clientPanelService.fetchClientPanelBusiness
      .mockResolvedValueOnce(editorFixture)
      .mockResolvedValueOnce({
        ...editorFixture,
        business: {
          ...editorFixture.business,
          description: 'Atualizado pelo backend',
        },
      });

    const view = render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Operacao do tenant')).toBeInTheDocument();

    await waitFor(() => {
      expect(tenantRealtimeService.subscribeToTenantUpdates).toHaveBeenCalledWith(
        {
          businessId: 'business-1',
          slug: 'barbearia-estilo-vivo',
        },
        expect.objectContaining({
          onTenantUpdated: expect.any(Function),
        }),
      );
    });

    const nameInput = screen.getByLabelText('Nome do negocio');
    await user.clear(nameInput);
    await user.type(nameInput, 'Edicao local preservada');

    await act(async () => {
      await realtimeCallbacks.onTenantUpdated?.({
        businessId: 'business-1',
        kind: 'order_created',
        emittedAt: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(clientPanelService.fetchClientPanelBusiness).toHaveBeenCalledTimes(2);
      expect(clientPanelService.fetchClientPanelAnalytics).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByLabelText('Nome do negocio')).toHaveValue('Edicao local preservada');

    view.unmount();

    expect(realtimeCleanup).toHaveBeenCalledTimes(1);
  });

  it('renders safe fallback labels for unknown analytics tokens in the client panel', async () => {
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
    clientPanelService.fetchClientPanelAnalytics.mockResolvedValueOnce({
      scope: 'advanced',
      totals: {
        totalEvents: 4,
        last7DaysEvents: 4,
        pageViews: 2,
      },
      metrics: {
        totalEvents: 4,
        pageViews: 2,
        interactions: 2,
        actionRate: 100,
      },
      timeline: [
        { date: '2026-06-01', totalEvents: 4, pageViews: 2, interactions: 2 },
      ],
      byEventType: [
        { eventType: 'mystery_event', label: '', count: 2, share: 50 },
      ],
      topTargets: [
        { targetType: 'special_offer', targetTypeLabel: '', targetLabel: '', count: 2, share: 50 },
      ],
      recentEvents: [
        {
          id: 'event-1',
          eventType: 'weird_click',
          eventTypeLabel: '',
          targetType: 'special_offer',
          targetTypeLabel: '',
          targetLabel: '',
          displayLabel: '',
          occurredAt: '2026-06-01T12:00:00.000Z',
        },
      ],
      uniqueVisitors: 2,
    });

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Operacao do tenant')).toBeInTheDocument();
    expect(await screen.findByText('Mystery Event')).toBeInTheDocument();
    expect(await screen.findAllByText('Special Offer')).not.toHaveLength(0);
    expect(screen.getByLabelText('Legenda do grafico de analytics')).toBeInTheDocument();
  });
});
