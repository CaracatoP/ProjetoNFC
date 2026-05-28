import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminClientsPanel } from './AdminClientsPanel.jsx';
import * as adminService from '@/services/adminService.js';

vi.mock('@/services/adminService.js', () => ({
  listAdminClients: vi.fn(),
  createAdminClientAccount: vi.fn(),
  updateAdminClientAccount: vi.fn(),
  updateAdminClientAccessLevel: vi.fn(),
  resetAdminClientPassword: vi.fn(),
  blockAdminClient: vi.fn(),
  unblockAdminClient: vi.fn(),
  updateAdminClientPlan: vi.fn(),
  updateAdminClientBillingStatus: vi.fn(),
}));

const businessesFixture = [
  { id: 'business-1', name: 'Barbearia Estilo Vivo', slug: 'barbearia-estilo-vivo' },
  { id: 'business-2', name: 'Restaurante Vista Boa', slug: 'restaurante-vista-boa' },
];

const clientsFixture = [
  {
    user: {
      id: 'client-1',
      displayName: 'Carlos Dono',
      email: 'carlos@cliente.local',
      roleLevel: 2,
      status: 'active',
    },
    business: {
      id: 'business-1',
      name: 'Barbearia Estilo Vivo',
      slug: 'barbearia-estilo-vivo',
    },
    subscription: {
      plan: {
        code: 'premium',
        name: 'Premium',
      },
    },
    access: {
      billingStatus: 'paid',
    },
  },
  {
    user: {
      id: 'client-2',
      displayName: 'Ana Gerente',
      email: 'ana@cliente.local',
      roleLevel: 3,
      status: 'disabled',
    },
    business: {
      id: 'business-2',
      name: 'Restaurante Vista Boa',
      slug: 'restaurante-vista-boa',
    },
    subscription: {
      plan: {
        code: 'pro',
        name: 'Pro',
      },
    },
    access: {
      billingStatus: 'overdue',
    },
  },
];

describe('AdminClientsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminService.listAdminClients.mockResolvedValue(clientsFixture);
    adminService.createAdminClientAccount.mockResolvedValue({
      ...clientsFixture[0],
      user: {
        ...clientsFixture[0].user,
        id: 'client-3',
        displayName: 'Cliente Novo',
        email: 'novo@cliente.local',
      },
    });
    adminService.updateAdminClientAccount.mockResolvedValue(clientsFixture[0]);
    adminService.updateAdminClientAccessLevel.mockResolvedValue(clientsFixture[0]);
    adminService.resetAdminClientPassword.mockResolvedValue(clientsFixture[0]);
    adminService.blockAdminClient.mockResolvedValue({
      ...clientsFixture[0],
      user: {
        ...clientsFixture[0].user,
        status: 'disabled',
      },
    });
    adminService.unblockAdminClient.mockResolvedValue(clientsFixture[0]);
    adminService.updateAdminClientPlan.mockResolvedValue({
      ...clientsFixture[0],
      subscription: {
        plan: {
          code: 'enterprise',
          name: 'Enterprise',
        },
      },
    });
    adminService.updateAdminClientBillingStatus.mockResolvedValue({
      ...clientsFixture[0],
      access: {
        billingStatus: 'trial',
      },
    });
  });

  it('lets the super admin create a client and update plan or billing', async () => {
    const user = userEvent.setup();

    render(
      <AdminClientsPanel
        token="admin-token"
        businesses={businessesFixture}
        canManageBilling
        onOpenBusiness={vi.fn()}
      />,
    );

    expect(await screen.findByText('Base comercial')).toBeInTheDocument();

    const createCard = screen.getByText('Cadastrar cliente').closest('section');
    const createScope = within(createCard);

    await user.type(createScope.getByLabelText('Nome'), 'Cliente Novo');
    await user.type(createScope.getByLabelText('E-mail'), 'novo@cliente.local');
    await user.type(createScope.getByLabelText('Senha inicial'), 'senha12345');
    await user.selectOptions(createScope.getByLabelText('Tenant vinculado'), 'business-2');
    await user.selectOptions(createScope.getByLabelText('Nivel'), '3');
    await user.click(createScope.getByRole('button', { name: /Criar cliente/i }));

    await waitFor(() => {
      expect(adminService.createAdminClientAccount).toHaveBeenCalledWith('admin-token', expect.objectContaining({
        name: 'Cliente Novo',
        email: 'novo@cliente.local',
        businessId: 'business-2',
        roleLevel: 3,
      }));
    });

    const planCard = screen.getByText('Controles financeiros').closest('section');
    const planScope = within(planCard);

    await user.selectOptions(planScope.getByLabelText('Plano contratado'), 'enterprise');
    await user.click(planScope.getByRole('button', { name: /Atualizar plano/i }));

    await waitFor(() => {
      expect(adminService.updateAdminClientPlan).toHaveBeenCalledWith('admin-token', 'client-1', 'enterprise');
    });

    await user.selectOptions(planScope.getByLabelText('Status financeiro'), 'trial');
    await user.click(planScope.getByRole('button', { name: /Atualizar status financeiro/i }));

    await waitFor(() => {
      expect(adminService.updateAdminClientBillingStatus).toHaveBeenCalledWith('admin-token', 'client-1', 'trial');
    });
  });

  it('keeps financial controls blocked for level 1 while still allowing password reset and operational edits', async () => {
    const user = userEvent.setup();

    render(
      <AdminClientsPanel
        token="admin-token"
        businesses={businessesFixture}
        canManageBilling={false}
        onOpenBusiness={vi.fn()}
      />,
    );

    expect(await screen.findByText('Base comercial')).toBeInTheDocument();

    const planCard = screen.getByText('Controles financeiros').closest('section');
    const planScope = within(planCard);

    expect(planScope.getByLabelText('Plano contratado')).toBeDisabled();
    expect(planScope.getByLabelText('Status financeiro')).toBeDisabled();
    expect(planScope.getByRole('button', { name: /Atualizar plano/i })).toBeDisabled();
    expect(planScope.getByRole('button', { name: /Atualizar status financeiro/i })).toBeDisabled();

    const securityCard = screen.getByText('Reset de senha').closest('section');
    const securityScope = within(securityCard);

    await user.type(securityScope.getByLabelText('Nova senha'), 'novasenha123');
    await user.click(securityScope.getByRole('button', { name: /Resetar senha/i }));

    await waitFor(() => {
      expect(adminService.resetAdminClientPassword).toHaveBeenCalledWith('admin-token', 'client-1', 'novasenha123');
    });
  });
});
