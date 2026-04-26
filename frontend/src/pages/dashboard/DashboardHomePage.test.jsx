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
}));

const overviewFixture = {
  totals: {
    activeBusinesses: 1,
    draftBusinesses: 1,
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
  },
  theme: {
    colors: {
      primary: '#f97316',
      secondary: '#fb7185',
      background: '#140d09',
      text: '#fff8f2',
    },
    typography: {},
    spacing: {},
    radius: {},
    layout: {},
    buttons: {},
    customCss: '',
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
  analytics: {
    totalEvents: 24,
    last7DaysEvents: 10,
    byEventType: [{ eventType: 'page_view', count: 16 }],
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
          }),
        }),
      );
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

  it('rebuilds derived theme tokens when the admin changes the palette', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace da operacao')).toBeInTheDocument();
    expect(await screen.findByText('Identidade do tenant')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Configuracoes/i }));
    const primaryColorInput = screen.getByLabelText('Cor primaria');
    fireEvent.change(primaryColorInput, { target: { value: '#22c55e' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar alteracoes/i }));

    await waitFor(() => {
      const saveCall = adminService.updateAdminBusiness.mock.calls
        .filter((call) => call[0] === 'admin-token' && call[1] === 'business-1')
        .at(-1);

      expect(saveCall?.[2]?.theme?.colors?.primary).toBe('#22c55e');
      expect(saveCall?.[2]?.theme?.colors?.accent).toContain('34, 197, 94');
      expect(saveCall?.[2]?.theme?.buttons?.primary?.background).toContain('#22c55e');
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
