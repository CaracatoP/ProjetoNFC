import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardHomePage } from './DashboardHomePage.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import * as adminService from '@/services/adminService.js';
import { ApiClientError } from '@/services/apiClient.js';

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/adminService.js', () => ({
  fetchAdminOverview: vi.fn(),
  listAdminBusinesses: vi.fn(),
  getAdminBusiness: vi.fn(),
  createAdminBusiness: vi.fn(),
  updateAdminBusiness: vi.fn(),
  updateAdminBusinessStatus: vi.fn(),
  deleteAdminBusiness: vi.fn(),
  uploadAdminImage: vi.fn(),
  createTenantProfessional: vi.fn(),
  updateTenantProfessional: vi.fn(),
  deleteTenantProfessional: vi.fn(),
  createTenantAppointmentService: vi.fn(),
  updateTenantAppointmentService: vi.fn(),
  deleteTenantAppointmentService: vi.fn(),
  createTenantProduct: vi.fn(),
  updateTenantProduct: vi.fn(),
  deleteTenantProduct: vi.fn(),
  updateTenantAppointmentRequestStatus: vi.fn(),
  updateTenantOrderStatus: vi.fn(),
}));

const overviewFixture = {
  totals: {
    activeBusinesses: 1,
    draftBusinesses: 1,
    inactiveBusinesses: 1,
    totalEvents: 24,
    last7DaysEvents: 10,
  },
  topBusinesses: [
    {
      businessId: 'business-1',
      name: 'Barbearia Estilo Vivo',
      slug: 'barbearia-estilo-vivo',
      eventCount: 18,
    },
  ],
  recentEvents: [
    {
      id: 'event-1',
      businessName: 'Barbearia Estilo Vivo',
      eventType: 'page_view',
      targetLabel: '',
      occurredAt: '2026-04-16T18:20:00.000Z',
    },
  ],
  uploadConfig: {
    maxFileSizeMb: 5,
    acceptedMimeTypes: ['image/jpeg', 'image/png'],
  },
  analytics: {
    highlights: {
      totalEvents: 24,
      last7DaysEvents: 10,
      pageViews: 16,
      linkClicks: 6,
      ctaClicks: 1,
      copyActions: 1,
      shortcutClicks: 4,
      uniqueVisitors: 9,
      actionRate: 50,
    },
    timeline: [
      { date: '2026-04-15', totalEvents: 2, pageViews: 1, interactions: 1, linkClicks: 1 },
      { date: '2026-04-16', totalEvents: 6, pageViews: 4, interactions: 2, linkClicks: 2 },
      { date: '2026-04-17', totalEvents: 4, pageViews: 3, interactions: 1, linkClicks: 1 },
    ],
    byEventType: [
      { eventType: 'page_view', label: 'Page View', count: 16, share: 66.7 },
      { eventType: 'link_click', label: 'Link Click', count: 6, share: 25 },
    ],
    topLinks: [
      { key: 'instagram', label: 'Instagram', businessName: 'Barbearia Estilo Vivo', count: 3 },
    ],
    topShortcuts: [
      { key: 'whatsapp', label: 'WhatsApp', businessName: 'Barbearia Estilo Vivo', count: 4 },
    ],
    topTenants: [
      {
        businessId: 'business-1',
        name: 'Barbearia Estilo Vivo',
        slug: 'barbearia-estilo-vivo',
        eventCount: 18,
      },
    ],
    recentEvents: [
      {
        id: 'event-1',
        eventType: 'page_view',
        targetType: 'page',
        targetLabel: 'Landing page',
        occurredAt: '2026-04-16T18:20:00.000Z',
        businessName: 'Barbearia Estilo Vivo',
      },
    ],
    devices: [
      { label: 'Mobile', count: 14, share: 58.3 },
      { label: 'Desktop', count: 10, share: 41.7 },
    ],
    browsers: [
      { label: 'Chrome', count: 17, share: 70.8 },
      { label: 'Safari', count: 7, share: 29.2 },
    ],
  },
};

const businessFixture = {
  id: 'business-1',
  name: 'Barbearia Estilo Vivo',
  slug: 'barbearia-estilo-vivo',
  status: 'active',
  publicUrl: 'https://taplinkapp.vercel.app/site/barbearia-estilo-vivo',
  analytics: {
    totalEvents: 24,
  },
};

const secondaryBusinessFixture = {
  id: 'business-2',
  name: 'Loja Central',
  slug: 'loja-central',
  status: 'inactive',
  publicUrl: 'https://taplinkapp.vercel.app/site/loja-central',
  analytics: {
    totalEvents: 4,
  },
};

const editorFixture = {
  business: {
    id: 'business-1',
    name: 'Barbearia Estilo Vivo',
    slug: 'barbearia-estilo-vivo',
    description: 'Experiencia premium',
    logoUrl: '',
    bannerUrl: '',
    badge: 'Corte premium',
    status: 'active',
    publicUrl: 'https://taplinkapp.vercel.app/site/barbearia-estilo-vivo',
    rating: '4.9',
    domains: {
      subdomain: '',
      customDomain: '',
    },
    address: {
      display: 'Av. Paulista, 1000',
      mapUrl: 'https://maps.example.com',
      embedUrl: '',
    },
    hours: [{ id: 'weekday', label: 'Seg-Sex', value: '09:00 - 19:00' }],
    contact: {
      whatsapp: '5511999999999',
      phone: '1130000000',
      email: 'contato@example.com',
      wifi: {
        ssid: 'EstiloVivo',
        password: 'senha123',
      },
      pix: {
        keyType: 'cpf',
        key: '12345678900',
        receiverName: 'Barbearia Estilo Vivo',
      },
    },
    seo: {
      title: 'Barbearia Estilo Vivo',
      description: 'Pagina publica da barbearia',
      imageUrl: '',
    },
    segment: 'barbershop',
    modules: {
      catalog: true,
      appointments: true,
      cart: false,
      orders: false,
      loyalty: true,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      label: 'Barbearia',
      description: 'Ideal para agenda, vitrine de servicos e relacionamento recorrente.',
      catalogTitle: 'Servicos e produtos',
      appointmentTitle: 'Solicitar agendamento',
      loyaltyTitle: 'Programa de fidelidade',
    },
  },
  theme: {
    version: 2,
    backgroundColor: '#140d09',
    cardColor: '#221612',
    buttonHoverColor: '#2c1c17',
    primaryButtonColor: '#f97316',
    textColor: '#fff8f2',
    accentColor: '#fb7185',
    borderColor: '#4b342d',
    secondaryColor: '#7c3aed',
  },
  links: [
    {
      id: 'link-1',
      type: 'contact',
      group: 'primary',
      label: 'Enviar mensagem',
      subtitle: 'WhatsApp',
      icon: 'whatsapp',
      url: '',
      value: '',
      visible: true,
      order: 1,
      target: '_blank',
      metadata: { action: 'whatsapp' },
    },
  ],
  sections: [
    {
      id: 'section-hero',
      key: 'hero',
      type: 'hero',
      title: 'Hero',
      description: '',
      order: 1,
      visible: true,
      variant: '',
      settings: {},
      items: [],
    },
    {
      id: 'section-services',
      key: 'services',
      type: 'services',
      title: 'Servicos',
      description: '',
      order: 2,
      visible: true,
      variant: '',
      settings: {},
      items: [{ id: 'service-1', name: 'Corte', description: 'Classico', price: 45 }],
    },
    {
      id: 'section-gallery',
      key: 'gallery',
      type: 'gallery',
      title: 'Galeria',
      description: '',
      order: 3,
      visible: true,
      variant: '',
      settings: {},
      items: [{ id: 'gallery-1', imageUrl: '', alt: 'Foto 1' }],
    },
    {
      id: 'section-about',
      key: 'about',
      type: 'custom',
      title: 'Sobre',
      description: '',
      order: 4,
      visible: true,
      variant: '',
      settings: {},
      items: [{ id: 'about-1', body: 'Historia do negocio' }],
    },
    {
      id: 'section-cta',
      key: 'cta',
      type: 'cta',
      title: 'CTA',
      description: '',
      order: 5,
      visible: true,
      variant: '',
      settings: {
        primaryAction: {
          label: 'Chamar no WhatsApp',
          href: 'https://wa.me/5511999999999',
        },
      },
      items: [],
    },
  ],
  nfcTag: {
    code: 'tag-demo-001',
    status: 'active',
  },
  modulesData: {
    professionals: [],
    appointmentServices: [],
    appointmentRequests: [],
    products: [],
    orders: [],
  },
  analytics: {
    totalEvents: 24,
    last7DaysEvents: 10,
    pageViews: 16,
    linkClicks: 6,
    ctaClicks: 1,
    copyActions: 1,
    shortcutClicks: 4,
    uniqueVisitors: 9,
    actionRate: 50,
    byEventType: [{ eventType: 'page_view', count: 16 }],
    timeline: [
      { date: '2026-04-15', totalEvents: 2, pageViews: 1, interactions: 1, linkClicks: 1 },
      { date: '2026-04-16', totalEvents: 5, pageViews: 3, interactions: 2, linkClicks: 2 },
    ],
    topLinks: [{ key: 'instagram', label: 'Instagram', count: 2 }],
    topShortcuts: [{ key: 'whatsapp', label: 'WhatsApp', count: 4 }],
    devices: [{ label: 'Mobile', count: 12, share: 60 }],
    browsers: [{ label: 'Chrome', count: 15, share: 75 }],
    recentEvents: [
      {
        id: 'event-1',
        eventType: 'page_view',
        targetType: 'page',
        targetLabel: 'Landing page',
        occurredAt: '2026-04-16T18:20:00.000Z',
      },
    ],
  },
};

describe('DashboardHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      token: 'admin-token',
      user: { displayName: 'Operacao TapLink' },
      logout: vi.fn(),
    });

    adminService.fetchAdminOverview.mockResolvedValue(overviewFixture);
    adminService.listAdminBusinesses.mockResolvedValue([businessFixture]);
    adminService.getAdminBusiness.mockResolvedValue(editorFixture);
    adminService.createAdminBusiness.mockResolvedValue({
      ...editorFixture,
      business: {
        ...editorFixture.business,
        id: 'business-2',
        name: 'Loja Nova',
        slug: 'loja-nova',
      },
    });
    adminService.updateAdminBusiness.mockResolvedValue(editorFixture);
    adminService.updateAdminBusinessStatus.mockResolvedValue({
      ...editorFixture,
      business: {
        ...editorFixture.business,
        status: 'inactive',
      },
    });
    adminService.deleteAdminBusiness.mockResolvedValue({ deleted: true });
    adminService.uploadAdminImage.mockResolvedValue({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/taplink/barbearia-estilo-vivo/logo.png',
      publicId: 'taplink/barbearia-estilo-vivo/logo-demo',
    });
  });

  it('loads admin overview and allows quick tenant onboarding', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();

    const onboardingCard = screen.getByText('Novo comercio').closest('section');
    const onboardingScope = within(onboardingCard);

    await user.type(onboardingScope.getByLabelText('Nome do comercio'), 'Loja Nova');
    await user.click(onboardingScope.getByRole('button', { name: /Criar tenant e abrir editor/i }));

    await waitFor(() => {
      expect(adminService.createAdminBusiness).toHaveBeenCalledWith(
        'admin-token',
        expect.objectContaining({
          business: expect.objectContaining({
            name: 'Loja Nova',
            slug: 'loja-nova',
            status: 'active',
            segment: 'other',
          }),
        }),
      );
    });
  });

  it('shows segment presets in onboarding and sends the suggested modules when creating', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    const onboardingCard = (await screen.findByText('Novo comercio')).closest('section');
    const onboardingScope = within(onboardingCard);

    await user.selectOptions(onboardingScope.getByLabelText('Segmento da empresa'), 'restaurant');
    await user.type(onboardingScope.getByLabelText('Nome do comercio'), 'Bistro TapLink');
    await user.click(onboardingScope.getByRole('button', { name: /Criar tenant e abrir editor/i }));

    await waitFor(() => {
      expect(adminService.createAdminBusiness).toHaveBeenCalledWith(
        'admin-token',
        expect.objectContaining({
          business: expect.objectContaining({
            segment: 'restaurant',
          }),
        }),
      );
    });

    const createdPayload = adminService.createAdminBusiness.mock.calls.at(-1)?.[1];
    expect(createdPayload?.business?.modules).toMatchObject({
      catalog: true,
      cart: true,
      orders: true,
      whatsapp: true,
    });
  });

  it('shows validation details when the editor payload is rejected', async () => {
    const user = userEvent.setup();

    adminService.updateAdminBusiness.mockRejectedValue(
      new ApiClientError('Falha de validacao', 400, [
        { path: 'business.seo.title', message: 'String must contain at least 2 character(s)' },
      ]),
    );

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    expect(await screen.findByText(/business\.seo\.title: String must contain at least 2 character/)).toBeInTheDocument();
  });

  it('slugifies the editor slug before saving', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();

    const editorCard = screen.getByText('Identidade do tenant').closest('section');
    const slugInput = within(editorCard).getByLabelText('Slug publico');
    await user.clear(slugInput);
    await user.type(slugInput, 'Barbearia São João 2026');
    await user.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    await waitFor(() => {
      expect(
        adminService.updateAdminBusiness.mock.calls.some(
          (call) => call[0] === 'admin-token' && call[1] === 'business-1' && call[2]?.business?.slug === 'barbearia-sao-joao-2026',
        ),
      ).toBe(true);
    });
  });

  it('allows editing multiple business hours before saving', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Contato e atendimento')).toBeInTheDocument();

    const contactCard = screen.getByText('Contato e atendimento').closest('section');
    const contactScope = within(contactCard);

    await user.click(contactScope.getByRole('button', { name: /Adicionar horario/i }));

    const periodInputs = contactScope.getAllByLabelText('Dia ou periodo');
    const rangeInputs = contactScope.getAllByLabelText('Faixa de horario');

    await user.type(periodInputs[1], 'Sabado');
    await user.type(rangeInputs[1], '09:00 - 17:00');
    await user.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    await waitFor(() => {
      const saveCall = adminService.updateAdminBusiness.mock.calls
        .filter((call) => call[0] === 'admin-token' && call[1] === 'business-1')
        .at(-1);

      expect(saveCall?.[2]?.business?.hours).toEqual([
        { id: 'weekday', label: 'Seg-Sex', value: '09:00 - 19:00' },
        expect.objectContaining({ label: 'Sabado', value: '09:00 - 17:00' }),
      ]);
    });
  });

  it('renders the eight visual customization controls and keeps the live preview independent when only the background changes', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Configuracoes/i }));

    expect(screen.getByText('Personalizacao Visual')).toBeInTheDocument();

    expect(screen.getByLabelText('Cor de fundo principal')).toBeInTheDocument();
    expect(screen.getByLabelText('Cor dos cards/botoes')).toBeInTheDocument();
    expect(screen.getByLabelText('Cor de hover dos botoes')).toBeInTheDocument();
    expect(screen.getByLabelText('Cor do botao principal/destaque')).toBeInTheDocument();
    expect(screen.getByLabelText('Cor do texto principal')).toBeInTheDocument();
    expect(screen.getByLabelText('Cor dos icones/detalhes')).toBeInTheDocument();
    expect(screen.getByLabelText('Cor das bordas/linhas')).toBeInTheDocument();
    expect(screen.getByLabelText('Cor secundaria')).toBeInTheDocument();

    const backgroundColorInput = screen.getByLabelText('Cor de fundo principal');
    fireEvent.change(backgroundColorInput, { target: { value: '#f3ecdf' } });

    const livePreview = screen.getByTestId('theme-live-preview');
    expect(livePreview.style.getPropertyValue('--theme-background')).toBe('#f3ecdf');
    expect(livePreview.style.getPropertyValue('--theme-primary-button')).toBe('#f97316');
    expect(livePreview.style.getPropertyValue('--theme-card')).toBe('#221612');
    expect(livePreview.style.getPropertyValue('--theme-secondary-area')).toBe('#7c3aed');

    fireEvent.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    await waitFor(() => {
      const saveCall = adminService.updateAdminBusiness.mock.calls
        .filter((call) => call[0] === 'admin-token' && call[1] === 'business-1')
        .at(-1);

      expect(saveCall?.[2]?.theme?.raw?.version).toBe(2);
      expect(saveCall?.[2]?.theme?.raw?.backgroundColor).toBe('#f3ecdf');
      expect(saveCall?.[2]?.theme?.raw?.primaryButtonColor).toBe('#f97316');
      expect(saveCall?.[2]?.theme?.raw?.cardColor).toBe('#221612');
      expect(saveCall?.[2]?.theme?.raw?.secondaryColor).toBe('#7c3aed');
    });
  });

  it('applies a preset palette and still lets the admin fine-tune colors individually', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Configuracoes/i }));

    await user.click(screen.getByRole('button', { name: /Escuro premium/i }));

    expect(screen.getByLabelText('Cor do botao principal/destaque')).toHaveValue('#d4a24c');
    expect(screen.getByLabelText('Cor secundaria')).toHaveValue('#5b6cff');
    expect(screen.getByLabelText('Cor de fundo principal')).toHaveValue('#0d1321');
    expect(screen.getByLabelText('Cor do texto principal')).toHaveValue('#f5f1e8');
    expect(screen.getByLabelText('Cor dos cards/botoes')).toHaveValue('#171f31');
    expect(screen.getByLabelText('Cor de hover dos botoes')).toHaveValue('#243048');
    expect(screen.getByLabelText('Cor dos icones/detalhes')).toHaveValue('#d4a24c');
    expect(screen.getByLabelText('Cor das bordas/linhas')).toHaveValue('#32405d');

    fireEvent.change(screen.getByLabelText('Cor secundaria'), { target: { value: '#ff4d6d' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    await waitFor(() => {
      const saveCall = adminService.updateAdminBusiness.mock.calls
        .filter((call) => call[0] === 'admin-token' && call[1] === 'business-1')
        .at(-1);

      expect(saveCall?.[2]?.theme?.raw?.backgroundColor).toBe('#0d1321');
      expect(saveCall?.[2]?.theme?.raw?.primaryButtonColor).toBe('#d4a24c');
      expect(saveCall?.[2]?.theme?.raw?.secondaryColor).toBe('#ff4d6d');
      expect(saveCall?.[2]?.theme?.raw?.textColor).toBe('#f5f1e8');
      expect(saveCall?.[2]?.theme?.raw?.cardColor).toBe('#171f31');
    });
  });

  it('toggles the tenant status from the editor header', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Inativar site/i }));

    await waitFor(() => {
      expect(adminService.updateAdminBusinessStatus).toHaveBeenCalledWith('admin-token', 'business-1', 'inactive');
    });

    expect(
      await screen.findByText(/Site inativado com sucesso\. O publico agora ve uma mensagem neutra de indisponibilidade\./i),
    ).toBeInTheDocument();
  });

  it('filters tenants by search term without reloading the dashboard', async () => {
    const user = userEvent.setup();
    adminService.listAdminBusinesses.mockResolvedValue([businessFixture, secondaryBusinessFixture]);

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    const tenantListCard = await screen.findByText('Tenants');
    const tenantListScope = within(tenantListCard.closest('section'));
    expect(tenantListScope.getByRole('button', { name: /Loja Central/i })).toBeInTheDocument();

    await user.type(tenantListScope.getByLabelText('Buscar tenant'), 'barbearia');

    await waitFor(() => {
      expect(tenantListScope.queryByRole('button', { name: /Loja Central/i })).not.toBeInTheDocument();
    });

    expect(tenantListScope.getByRole('button', { name: /Barbearia Estilo Vivo/i })).toBeInTheDocument();
  });

  it('duplicates the current tenant with unique name and slug', async () => {
    const user = userEvent.setup();
    adminService.getAdminBusiness.mockResolvedValueOnce({
      ...editorFixture,
      business: {
        ...editorFixture.business,
        domains: {
          subdomain: 'estilo-vivo',
          customDomain: 'cliente-estilo-vivo.com.br',
          customDomainVerifiedAt: '2026-04-20T10:00:00.000Z',
        },
      },
    });
    adminService.createAdminBusiness.mockClear();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Duplicar tenant/i }));

    await waitFor(() => {
      expect(adminService.createAdminBusiness).toHaveBeenCalledWith(
        'admin-token',
        expect.objectContaining({
          business: expect.objectContaining({
            name: 'Barbearia Estilo Vivo (copy)',
            slug: 'barbearia-estilo-vivo-copy',
            domains: expect.objectContaining({
              subdomain: '',
              customDomain: '',
            }),
          }),
          nfcTag: expect.objectContaining({
            code: '',
          }),
        }),
      );
    });
  });

  it('saves the duplicated tenant using the copy id without overwriting the original tenant', async () => {
    const user = userEvent.setup();
    const duplicatedBusinessFixture = {
      ...businessFixture,
      id: 'business-2',
      name: 'Barbearia Estilo Vivo (copy)',
      slug: 'barbearia-estilo-vivo-copy',
      publicUrl: 'https://taplinkapp.vercel.app/site/barbearia-estilo-vivo-copy',
    };
    const duplicatedEditorFixture = {
      ...editorFixture,
      business: {
        ...editorFixture.business,
        id: 'business-2',
        name: 'Barbearia Estilo Vivo (copy)',
        slug: 'barbearia-estilo-vivo-copy',
        publicUrl: 'https://taplinkapp.vercel.app/site/barbearia-estilo-vivo-copy',
      },
    };

    adminService.listAdminBusinesses.mockReset();
    adminService.listAdminBusinesses
      .mockResolvedValueOnce([businessFixture])
      .mockResolvedValueOnce([businessFixture, duplicatedBusinessFixture])
      .mockResolvedValue([businessFixture, duplicatedBusinessFixture]);

    adminService.getAdminBusiness.mockReset();
    adminService.getAdminBusiness
      .mockResolvedValueOnce(editorFixture)
      .mockResolvedValueOnce(duplicatedEditorFixture)
      .mockResolvedValue({
        ...duplicatedEditorFixture,
        business: {
          ...duplicatedEditorFixture.business,
          slug: 'barbearia-estilo-vivo-copy-2',
          publicUrl: 'https://taplinkapp.vercel.app/site/barbearia-estilo-vivo-copy-2',
        },
      });

    adminService.createAdminBusiness.mockResolvedValueOnce(duplicatedEditorFixture);
    adminService.updateAdminBusiness.mockResolvedValueOnce({
      ...duplicatedEditorFixture,
      business: {
        ...duplicatedEditorFixture.business,
        slug: 'barbearia-estilo-vivo-copy-2',
        publicUrl: 'https://taplinkapp.vercel.app/site/barbearia-estilo-vivo-copy-2',
      },
    });

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Duplicar tenant/i }));

    await waitFor(() => {
      expect(adminService.getAdminBusiness).toHaveBeenCalledWith('admin-token', 'business-2');
    });

    const editorCard = screen.getByText('Identidade do tenant').closest('section');
    const slugInput = within(editorCard).getByLabelText('Slug publico');
    await user.clear(slugInput);
    await user.type(slugInput, 'barbearia-estilo-vivo-copy-2');
    await user.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    await waitFor(() => {
      expect(adminService.updateAdminBusiness).toHaveBeenCalledWith(
        'admin-token',
        'business-2',
        expect.objectContaining({
          business: expect.objectContaining({
            id: 'business-2',
            slug: 'barbearia-estilo-vivo-copy-2',
          }),
        }),
      );
    });

    expect(
      adminService.updateAdminBusiness.mock.calls.some(
        (call) => call[0] === 'admin-token' && call[1] === 'business-1' && call[2]?.business?.slug === 'barbearia-estilo-vivo-copy-2',
      ),
    ).toBe(false);
  });

  it('normalizes the tenant subdomain and updates the preview URL with the public site host', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();

    const editorCard = screen.getByText('Identidade do tenant').closest('section');
    const editorScope = within(editorCard);
    const subdomainInput = editorScope.getByPlaceholderText('studio-exemplo');

    await user.clear(subdomainInput);
    await user.type(subdomainInput, 'Studio Exemplo !!!');
    await user.tab();

    expect(subdomainInput).toHaveValue('studio-exemplo');
    expect(editorScope.getAllByText('https://studio-exemplo.taplinkapp.vercel.app')).toHaveLength(2);
  });

  it('builds the preview iframe URL with preview mode and refresh timestamp', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();

    const iframe = screen.getByTitle('Preview Barbearia Estilo Vivo');
    const firstPreviewUrl = iframe.getAttribute('src') || '';

    expect(firstPreviewUrl).toContain('/site/barbearia-estilo-vivo?preview=1&t=');

    await user.click(screen.getByRole('button', { name: /Atualizar preview/i }));

    await waitFor(() => {
      const refreshedPreviewUrl = screen.getByTitle('Preview Barbearia Estilo Vivo').getAttribute('src') || '';
      expect(refreshedPreviewUrl).toContain('/site/barbearia-estilo-vivo?preview=1&t=');
      expect(refreshedPreviewUrl).not.toBe(firstPreviewUrl);
    });
  });

  it('blocks save when inline validation finds an invalid whatsapp', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();
    const contactCard = screen.getByText('Contato e atendimento').closest('section');
    const whatsappInput = within(contactCard).getByLabelText('WhatsApp');
    await user.clear(whatsappInput);
    await user.type(whatsappInput, '123');
    await user.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    expect(await screen.findByText(/Corrija os campos destacados antes de salvar\./i)).toBeInTheDocument();
    expect(adminService.updateAdminBusiness).not.toHaveBeenCalled();
  });

  it('moves analytics into a dedicated dashboard area', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Analises/i }));

    expect(await screen.findByText('Centro de analytics')).toBeInTheDocument();
    expect(screen.getByText('Visitas ao longo do tempo')).toBeInTheDocument();
    expect(screen.getByText('Atalhos mais usados')).toBeInTheDocument();
    expect(screen.queryByText('Novo comercio')).not.toBeInTheDocument();
  });

  it('persists removed quick actions in the save payload instead of recreating them', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Links/i }));

    const linksCard = screen.getByText('Links e atalhos').closest('section');
    const linksScope = within(linksCard);

    await user.click(linksScope.getByRole('button', { name: /^Remover$/i }));
    expect(linksScope.queryByDisplayValue('Enviar mensagem')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    await waitFor(() => {
      const saveCall = adminService.updateAdminBusiness.mock.calls
        .filter((call) => call[0] === 'admin-token' && call[1] === 'business-1')
        .at(-1);

      expect(saveCall?.[2]?.links).toEqual([]);
      expect(
        saveCall?.[2]?.sections.find((section) => section.key === 'quick-actions')?.settings?.hiddenActions,
      ).toEqual(['whatsapp']);
    });
  });
});
