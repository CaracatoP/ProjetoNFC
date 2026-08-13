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
  fetchClientPanelFinance: vi.fn(),
  fetchClientPanelProducts: vi.fn(),
  fetchClientPanelOrders: vi.fn(),
  fetchClientPanelAppointmentRequests: vi.fn(),
  fetchClientPanelAppointmentServices: vi.fn(),
  fetchClientPanelProfessionals: vi.fn(),
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

const bootstrapFixture = {
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
  summary: {
    products: {
      total: 3,
      unavailable: 1,
      controlledStock: 2,
      lowStock: 1,
    },
    orders: {
      total: 4,
      received: 2,
      preparing: 1,
      ready: 0,
      open: 3,
    },
    appointments: {
      total: 2,
      pending: 1,
    },
    professionals: {
      total: 1,
    },
    services: {
      total: 2,
    },
    activeModules: 6,
    billingStatus: 'paid',
    generatedAt: '2026-08-10T10:00:00.000Z',
  },
  theme: {},
  links: [],
  sections: [],
  modulesData: {
    professionals: [],
    appointmentServices: [],
    appointmentRequests: [],
    products: [],
    orders: [],
  },
};

const productsFixture = [
  {
    id: 'product-1',
    name: 'Pomada modeladora',
    category: 'Finalizacao',
    price: 39.9,
    image: '',
    measurementUnit: 'unit',
    description: 'Fixacao media',
    isAvailable: true,
    inventory: {
      enabled: true,
      quantity: 4,
      minimumQuantity: 2,
      unit: 'unit',
      notes: 'Prateleira principal',
    },
    active: true,
  },
];

const ordersFixture = [
  {
    id: 'order-1',
    customerName: 'Carlos',
    customerPhone: '5511999999999',
    deliveryType: 'pickup',
    total: 79.8,
    status: 'received',
    createdAt: '2026-08-10T08:30:00.000Z',
    receivedAt: '2026-08-10T08:30:00.000Z',
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
];

const appointmentRequestsFixture = [
  {
    id: 'appointment-1',
    customerName: 'Marina',
    customerPhone: '5511988887777',
    requestedDate: '2026-08-11',
    requestedTime: '14:00',
    serviceName: 'Corte classico',
    professionalName: 'Lia',
    status: 'pending',
    notes: '',
  },
];

const analyticsFixture = {
  scope: 'advanced',
  baselineAt: '2026-08-01T00:00:00.000Z',
  totals: {
    totalEvents: 24,
    last7DaysEvents: 10,
    pageViews: 16,
  },
  metrics: {
    totalEvents: 24,
    pageViews: 16,
    interactions: 8,
    actionRate: 50,
  },
  timeline: [
    { date: '2026-08-04', totalEvents: 2, pageViews: 1, interactions: 1 },
    { date: '2026-08-05', totalEvents: 3, pageViews: 2, interactions: 1 },
    { date: '2026-08-06', totalEvents: 3, pageViews: 2, interactions: 1 },
    { date: '2026-08-07', totalEvents: 4, pageViews: 3, interactions: 1 },
    { date: '2026-08-08', totalEvents: 4, pageViews: 3, interactions: 1 },
    { date: '2026-08-09', totalEvents: 4, pageViews: 2, interactions: 2 },
    { date: '2026-08-10', totalEvents: 4, pageViews: 3, interactions: 1 },
  ],
  byEventType: [
    { eventType: 'page_view', label: 'Page View', count: 16, share: 66.7 },
    { eventType: 'link_click', label: 'Link Click', count: 8, share: 33.3 },
  ],
  topTargets: [
    { targetType: 'whatsapp', targetTypeLabel: 'Whatsapp', label: 'Whatsapp', count: 5, share: 62.5 },
  ],
  recentEvents: [
    {
      id: 'event-1',
      eventType: 'link_click',
      eventTypeLabel: 'Link Click',
      targetType: 'whatsapp',
      targetTypeLabel: 'Whatsapp',
      targetLabel: '',
      displayLabel: 'Whatsapp',
      occurredAt: '2026-08-10T09:15:00.000Z',
    },
  ],
  uniqueVisitors: 6,
};

const financeFixture = {
  summary: {
    pendingBalance: 39.9,
    availableBalance: 0,
    totalReceived: 0,
    platformFees: 0,
    refunds: 0,
    totalPaidOut: 0,
    balanceDue: 0,
    settledNet: 0,
  },
  payout: {
    next: null,
    last: null,
  },
  history: [],
};

function buildOwnerAuth(overrides = {}) {
  return {
    token: 'client-token',
    user: { displayName: 'Cliente Dono', roleLevel: 2 },
    subscription: { plan: { name: 'Premium', code: 'premium' } },
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
    refreshSession: vi.fn(),
    ...overrides,
  };
}

function getSidebarNavButton(label) {
  const navigation = screen.getByRole('navigation', { name: /Navegacao do painel do cliente/i });
  const button = within(navigation)
    .getAllByRole('button')
    .find((candidate) => within(candidate).queryByText(label));

  if (!button) {
    throw new Error(`Botao de navegacao "${label}" nao encontrado.`);
  }

  return button;
}

describe('ClientPanelPage', () => {
  let realtimeCallbacks;
  let realtimeCleanup;

  beforeEach(() => {
    vi.clearAllMocks();
    window.requestIdleCallback = vi.fn(() => 1);
    window.cancelIdleCallback = vi.fn();

    realtimeCallbacks = {};
    realtimeCleanup = vi.fn();

    clientPanelService.fetchClientPanelBusiness.mockResolvedValue(bootstrapFixture);
    clientPanelService.updateClientPanelBusinessBasics.mockResolvedValue(bootstrapFixture);
    clientPanelService.fetchClientPanelProducts.mockResolvedValue(productsFixture);
    clientPanelService.fetchClientPanelOrders.mockResolvedValue(ordersFixture);
    clientPanelService.fetchClientPanelAppointmentRequests.mockResolvedValue(appointmentRequestsFixture);
    clientPanelService.fetchClientPanelAppointmentServices.mockResolvedValue([]);
    clientPanelService.fetchClientPanelProfessionals.mockResolvedValue([]);
    clientPanelService.fetchClientPanelAnalytics.mockResolvedValue(analyticsFixture);
    clientPanelService.fetchClientPanelFinance.mockResolvedValue(financeFixture);

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
      subscription: { plan: { name: 'Premium', code: 'premium' } },
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

  it('uses a lightweight bootstrap and lazy-loads the catalog only when the user opens that area', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue(buildOwnerAuth());

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();
    expect(clientPanelService.fetchClientPanelBusiness).toHaveBeenCalledWith('client-token', {
      includeModules: false,
      includeAnalytics: false,
      includeHistory: false,
    });
    expect(clientPanelService.fetchClientPanelProducts).not.toHaveBeenCalled();

    await user.click(getSidebarNavButton('Catalogo'));

    expect(await screen.findByRole('button', { name: /Expandir produto Pomada modeladora/i })).toBeInTheDocument();
    expect(clientPanelService.fetchClientPanelProducts).toHaveBeenCalledTimes(1);

    await user.click(getSidebarNavButton('Visao geral'));
    await user.click(getSidebarNavButton('Catalogo'));

    expect(clientPanelService.fetchClientPanelProducts).toHaveBeenCalledTimes(1);
  });

  it('keeps the client sidebar compact without the duplicated open site action', async () => {
    const logout = vi.fn();
    const user = userEvent.setup();
    useAuth.mockReturnValue(buildOwnerAuth({ logout }));

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: /Navegacao do painel do cliente/i });
    const sidebar = navigation.closest('aside');

    expect(sidebar).toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: /Abrir site/i })).not.toBeInTheDocument();
    const planSummary = within(sidebar).getByText('Plano').closest('.client-panel-sidebar__plan');
    expect(planSummary).toBeInTheDocument();
    expect(planSummary).toHaveTextContent('Premium');
    expect(planSummary).toHaveTextContent('Pago');

    await user.click(within(sidebar).getByRole('button', { name: /Sair/i }));
    expect(logout).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('link', { name: /Ver site/i })).toBeInTheDocument();
  });

  it('saves basic business settings from the dedicated settings view', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue(buildOwnerAuth());

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();

    await user.click(getSidebarNavButton('Configuracoes'));
    expect(await screen.findByText('Dados publicos do negocio')).toBeInTheDocument();

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

  it('loads orders on demand and lets authorized operators mark manual tenant payments as paid', async () => {
    const user = userEvent.setup();
    clientPanelService.updateClientPanelOrderPaymentStatus.mockResolvedValue({
      id: 'order-1',
      payment: {
        method: 'pix',
        status: 'paid',
        provider: 'manual',
        amount: 79.8,
      },
    });
    useAuth.mockReturnValue(buildOwnerAuth());

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();

    await user.click(getSidebarNavButton('Pedidos'));
    const receivedOrderCard = await screen.findByTestId('order-card-received');

    expect(clientPanelService.fetchClientPanelOrders).toHaveBeenCalledTimes(1);
    expect(within(receivedOrderCard).getByText(/Pix · R\$ 79,80/i)).toBeInTheDocument();
    expect(within(receivedOrderCard).getByText('Aguardando pagamento')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Marcar pagamento como pago/i }));

    await waitFor(() => {
      expect(clientPanelService.updateClientPanelOrderPaymentStatus).toHaveBeenCalledWith(
        'client-token',
        'order-1',
        'paid',
      );
    });
  });

  it('keeps the panel read-only for level 5 users while preserving tenant-safe views', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      token: 'client-token',
      user: { displayName: 'Visualizador', roleLevel: 5 },
      subscription: { plan: { name: 'Pro', code: 'pro' } },
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

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Configuracoes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Profissionais/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Servicos/i })).not.toBeInTheDocument();

    await user.click(getSidebarNavButton('Catalogo'));
    expect(await screen.findByText(/pode visualizar o catalogo, mas nao editar produtos/i)).toBeInTheDocument();
  });

  it('shows the analytics upgrade panel without calling the analytics endpoint when access is not enabled yet', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      ...buildOwnerAuth(),
      subscription: { plan: { name: 'Starter', code: 'starter' } },
      access: {
        billingStatus: 'paid',
        analyticsScope: 'none',
        capabilities: {
          ...buildOwnerAuth().access.capabilities,
          canViewAnalytics: false,
        },
      },
    });

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();

    await user.click(getSidebarNavButton('Analytics'));

    expect(await screen.findByText('Analytics indisponivel no plano atual')).toBeInTheDocument();
    expect(clientPanelService.fetchClientPanelAnalytics).not.toHaveBeenCalled();
  });

  it('refreshes session state after plan updates and only loads analytics when the user opens that area', async () => {
    const user = userEvent.setup();
    let forceAuthRerender = () => {};
    const authState = {
      ...buildOwnerAuth(),
      subscription: { plan: { name: 'Starter', code: 'starter' } },
      access: {
        billingStatus: 'paid',
        analyticsScope: 'none',
        capabilities: {
          ...buildOwnerAuth().access.capabilities,
          canViewAnalytics: false,
        },
      },
      refreshSession: vi.fn(async () => {
        authState.subscription = { plan: { name: 'Premium', code: 'premium' } };
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

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();

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
        emittedAt: new Date('2026-08-10T10:15:00.000Z').toISOString(),
      });
    });

    await waitFor(() => {
      expect(authState.refreshSession).toHaveBeenCalledTimes(1);
      expect(clientPanelService.fetchClientPanelBusiness).toHaveBeenCalledTimes(2);
      expect(clientPanelService.fetchClientPanelAnalytics).not.toHaveBeenCalled();
    });

    await user.click(getSidebarNavButton('Analytics'));

    await waitFor(() => {
      expect(clientPanelService.fetchClientPanelAnalytics).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Visao do tenant')).toBeInTheDocument();
      expect(screen.getAllByText('Avancado').length).toBeGreaterThan(0);
    });
  });

  it('refetches the tenant after realtime updates without discarding unsaved basic edits and cleans up on unmount', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue(buildOwnerAuth());

    clientPanelService.fetchClientPanelBusiness
      .mockResolvedValueOnce(bootstrapFixture)
      .mockResolvedValueOnce({
        ...bootstrapFixture,
        business: {
          ...bootstrapFixture.business,
          description: 'Atualizado pelo backend',
        },
      });

    const view = render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();

    await user.click(getSidebarNavButton('Configuracoes'));
    const nameInput = await screen.findByLabelText('Nome do negocio');
    await user.clear(nameInput);
    await user.type(nameInput, 'Edicao local preservada');

    await act(async () => {
      await realtimeCallbacks.onTenantUpdated?.({
        businessId: 'business-1',
        kind: 'order_created',
        emittedAt: new Date('2026-08-10T10:30:00.000Z').toISOString(),
      });
    });

    await waitFor(() => {
      expect(clientPanelService.fetchClientPanelBusiness).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByLabelText('Nome do negocio')).toHaveValue('Edicao local preservada');

    view.unmount();
    expect(realtimeCleanup).toHaveBeenCalledTimes(1);
  });

  it('refreshes orders and finance after payment_updated events without requiring manual reload', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue(buildOwnerAuth());

    const pendingOrders = [
      {
        ...ordersFixture[0],
        payment: {
          ...ordersFixture[0].payment,
          provider: 'asaas',
          status: 'pending',
          amount: 79.8,
        },
      },
    ];
    const paidOrders = [
      {
        ...ordersFixture[0],
        payment: {
          ...ordersFixture[0].payment,
          provider: 'asaas',
          status: 'paid',
          amount: 79.8,
          confirmedAt: '2026-08-10T08:35:00.000Z',
        },
      },
    ];
    const pendingFinance = {
      ...financeFixture,
      summary: {
        pendingBalance: 79.8,
        availableBalance: 0,
        totalReceived: 0,
        platformFees: 0,
        refunds: 0,
        totalPaidOut: 0,
        balanceDue: 0,
        settledNet: 0,
      },
      history: [],
    };
    const paidFinance = {
      ...financeFixture,
      summary: {
        pendingBalance: 0,
        availableBalance: 77.41,
        totalReceived: 79.8,
        platformFees: 2.39,
        refunds: 0,
        totalPaidOut: 0,
        balanceDue: 77.41,
        settledNet: 77.41,
      },
      history: [
        {
          id: 'ledger-1',
          orderId: 'order-1',
          typeLabel: 'Venda recebida',
          amount: 79.8,
          netAmount: 77.41,
        },
      ],
    };

    clientPanelService.fetchClientPanelOrders.mockReset();
    clientPanelService.fetchClientPanelOrders
      .mockResolvedValueOnce(pendingOrders)
      .mockResolvedValueOnce(paidOrders);
    clientPanelService.fetchClientPanelFinance.mockReset();
    clientPanelService.fetchClientPanelFinance
      .mockResolvedValueOnce(pendingFinance)
      .mockResolvedValueOnce(paidFinance);

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();

    await user.click(getSidebarNavButton('Pedidos'));
    const pendingOrderCard = (await screen.findByText('Carlos')).closest('.admin-order-card');
    expect(pendingOrderCard).toBeInTheDocument();
    expect(within(pendingOrderCard).getByText('Aguardando pagamento')).toBeInTheDocument();

    await user.click(getSidebarNavButton('Financeiro'));
    expect(await screen.findByText('Historico financeiro')).toBeInTheDocument();
    expect(screen.getByText('R$ 79,80')).toBeInTheDocument();

    await act(async () => {
      await realtimeCallbacks.onTenantUpdated?.({
        businessId: 'business-1',
        kind: 'payment_updated',
        emittedAt: new Date('2026-08-10T10:40:00.000Z').toISOString(),
      });
    });

    await waitFor(() => {
      expect(clientPanelService.fetchClientPanelOrders).toHaveBeenCalledTimes(2);
      expect(clientPanelService.fetchClientPanelFinance).toHaveBeenCalledTimes(2);
    });

    expect((await screen.findAllByText('R$ 77,41')).length).toBeGreaterThan(0);
    expect(screen.getByText('Venda recebida')).toBeInTheDocument();

    await user.click(getSidebarNavButton('Pedidos'));
    const paidOrderCard = (await screen.findByText('Carlos')).closest('.admin-order-card');
    expect(paidOrderCard).toBeInTheDocument();
    expect(within(paidOrderCard).getByText('Pago')).toBeInTheDocument();
  });

  it('renders safe fallback labels for unknown analytics tokens in the dedicated analytics view', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue(buildOwnerAuth());
    clientPanelService.fetchClientPanelAnalytics.mockResolvedValueOnce({
      scope: 'advanced',
      baselineAt: '2026-08-01T00:00:00.000Z',
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
        { date: '2026-08-10', totalEvents: 4, pageViews: 2, interactions: 2 },
      ],
      byEventType: [
        { eventType: 'mystery_event', label: '', count: 2, share: 50 },
      ],
      topTargets: [
        { targetType: 'special_offer', targetTypeLabel: '', targetLabel: '', label: '', count: 2, share: 50 },
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
          occurredAt: '2026-08-10T12:00:00.000Z',
        },
      ],
      uniqueVisitors: 2,
    });

    render(
      <MemoryRouter>
        <ClientPanelPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Visao geral' })).toBeInTheDocument();

    await user.click(getSidebarNavButton('Analytics'));

    expect(await screen.findByText('Mystery Event')).toBeInTheDocument();
    expect(await screen.findAllByText('Special Offer')).not.toHaveLength(0);
    expect(screen.getByLabelText('Legenda do grafico de analytics')).toBeInTheDocument();
  });
});
