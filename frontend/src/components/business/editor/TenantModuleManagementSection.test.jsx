import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantModuleManagementSection } from './TenantModuleManagementSection.jsx';

function buildDraft(overrides = {}) {
  return {
    business: {
      id: 'business-1',
      name: 'Barbearia Estilo Vivo',
      slug: 'barbearia-estilo-vivo',
      segment: 'barbershop',
      modules: {
        catalog: true,
        appointments: true,
        cart: true,
        orders: true,
        loyalty: true,
        whatsapp: true,
        analytics: true,
      },
      segmentConfig: {
        label: 'Barbearia',
        description: 'Preset para barbearias',
      },
    },
    modulesData: {
      professionals: [],
      appointmentServices: [],
      products: [],
      appointmentRequests: [
        {
          id: 'appointment-1',
          customerName: 'Carlos',
          customerPhone: '5511999999999',
          requestedDate: '2026-06-20',
          requestedTime: '09:30',
          serviceName: 'Corte classico',
          professionalName: 'Lia',
          status: 'pending',
          notes: '',
        },
        {
          id: 'appointment-2',
          customerName: 'Marina',
          customerPhone: '5511988887777',
          requestedDate: '2026-06-21',
          requestedTime: '11:00',
          serviceName: 'Barba',
          professionalName: 'Rafael',
          status: 'confirmed',
          notes: '',
        },
      ],
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
          },
          items: [{ name: 'Pomada', quantity: 2, unitPrice: 39.9 }],
          notes: '',
        },
        {
          id: 'order-2',
          customerName: 'Marina',
          customerPhone: '5511988887777',
          deliveryType: 'delivery',
          total: 29.9,
          status: 'ready',
          payment: {
            method: 'cash_on_delivery',
            status: 'paid',
            provider: 'manual',
            amount: 29.9,
          },
          items: [{ name: 'Escova', quantity: 1, unitPrice: 29.9 }],
          notes: 'Entregar na recepcao',
        },
      ],
    },
    ...overrides,
  };
}

describe('TenantModuleManagementSection', () => {
  it('shows only tabs for active modules and filters inboxes by status', async () => {
    const user = userEvent.setup();

    render(
      <TenantModuleManagementSection
        draft={buildDraft()}
        onDraftChange={vi.fn()}
        moduleActions={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agendamentos' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pedidos' }));
    await user.selectOptions(screen.getByLabelText('Filtrar pedidos por status'), 'ready');

    expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
    expect(screen.getByText('Marina')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?29,90/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Agendamentos' }));
    await user.selectOptions(screen.getByLabelText('Filtrar agendamentos por status'), 'confirmed');

    expect(screen.queryByText('5511999999999')).not.toBeInTheDocument();
    expect(screen.getByText('5511988887777')).toBeInTheDocument();
  });

  it('renders improved empty-state copy for orders and appointment requests', async () => {
    const user = userEvent.setup();

    render(
      <TenantModuleManagementSection
        draft={buildDraft({
          modulesData: {
            professionals: [],
            appointmentServices: [],
            products: [],
            appointmentRequests: [],
            orders: [],
          },
        })}
        onDraftChange={vi.fn()}
        moduleActions={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Pedidos' }));
    expect(screen.getByText('Nenhum pedido recebido')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Agendamentos' }));
    expect(screen.getByText(/Nenhuma solicita/)).toBeInTheDocument();
  });

  it('uploads inline images for products and professionals using the shared admin upload flow', async () => {
    const user = userEvent.setup();
    const onUpload = vi
      .fn()
      .mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/demo/image/upload/v1/taplink/product.png',
        publicId: 'taplink/product',
      })
      .mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/demo/image/upload/v1/taplink/professional.png',
        publicId: 'taplink/professional',
      });

    const view = render(
      <TenantModuleManagementSection
        draft={buildDraft()}
        onDraftChange={vi.fn()}
        moduleActions={{}}
        onUpload={onUpload}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Catalogo' }));
    const productUploadInput = view.container.querySelector('input[type="file"]');
    await user.upload(productUploadInput, new File(['product'], 'product.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          tenantSlug: 'barbearia-estilo-vivo',
          assetType: 'product',
        }),
      );
    });

    expect(screen.getByDisplayValue('https://res.cloudinary.com/demo/image/upload/v1/taplink/product.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Profissionais' }));
    const professionalUploadInput = view.container.querySelector('input[type="file"]');
    await user.upload(professionalUploadInput, new File(['professional'], 'professional.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          tenantSlug: 'barbearia-estilo-vivo',
          assetType: 'professional',
        }),
      );
    });

    expect(screen.getByDisplayValue('https://res.cloudinary.com/demo/image/upload/v1/taplink/professional.png')).toBeInTheDocument();
  });

  it('keeps product creation collapsed by default in client mode and still allows create, cancel, and update flows', async () => {
    const user = userEvent.setup();
    const createProduct = vi.fn().mockResolvedValue({ id: 'product-new' });
    const updateProduct = vi.fn().mockResolvedValue({ id: 'product-1' });

    render(
      <TenantModuleManagementSection
        draft={buildDraft({
          modulesData: {
            professionals: [],
            appointmentServices: [],
            appointmentRequests: [],
            orders: [],
            products: [
              {
                id: 'product-1',
                name: 'Pomada modeladora',
                category: 'Finalizacao',
                price: 39.9,
                image: '',
                measurementUnit: 'unit',
                description: 'Fixacao media',
                active: true,
              },
            ],
          },
        })}
        onDraftChange={vi.fn()}
        moduleActions={{ createProduct, updateProduct }}
        mode="client"
        permissions={{
          canViewCatalog: true,
          canEditCatalog: true,
          canUploadMedia: true,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Catalogo' }));

    expect(screen.queryByTestId('client-product-create-form')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Adicionar produto' }));
    const createForm = screen.getByTestId('client-product-create-form');
    expect(createForm).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('client-product-create-form')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Adicionar produto' }));
    const reopenedCreateForm = screen.getByTestId('client-product-create-form');
    await user.type(within(reopenedCreateForm).getByLabelText('Produto'), 'Carvao Premium');
    await user.clear(within(reopenedCreateForm).getByLabelText('Preco'));
    await user.type(within(reopenedCreateForm).getByLabelText('Preco'), '29.9');
    await user.click(within(reopenedCreateForm).getByRole('button', { name: 'Salvar produto' }));

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Carvao Premium',
          price: 29.9,
        }),
      );
    });

    expect(screen.queryByTestId('client-product-create-form')).not.toBeInTheDocument();

    const existingProductNameInput = screen.getByDisplayValue('Pomada modeladora');
    await user.clear(existingProductNameInput);
    await user.type(existingProductNameInput, 'Pomada fosca');
    await user.click(screen.getAllByRole('button', { name: 'Salvar produto' })[0]);

    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalledWith(
        'product-1',
        expect.objectContaining({
          name: 'Pomada fosca',
        }),
      );
    });
  });

  it('filters catalog products in the management panel with a local search field', async () => {
    const user = userEvent.setup();

    render(
      <TenantModuleManagementSection
        draft={buildDraft({
          modulesData: {
            professionals: [],
            appointmentServices: [],
            appointmentRequests: [],
            orders: [],
            products: [
              {
                id: 'product-1',
                name: 'Pomada modeladora',
                category: 'Finalizacao',
                price: 39.9,
                image: '',
                measurementUnit: 'unit',
                description: 'Fixacao media',
                active: true,
              },
              {
                id: 'product-2',
                name: 'Carvao Premium',
                category: 'Churrasco',
                price: 29.9,
                image: '',
                measurementUnit: 'unit',
                description: 'Queima lenta',
                active: true,
              },
            ],
          },
        })}
        onDraftChange={vi.fn()}
        moduleActions={{}}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Catalogo' }));

    const searchInput = screen.getByPlaceholderText(/Buscar produto por nome, categoria ou descricao/i);
    await user.type(searchInput, 'churrasco');

    expect(screen.getByDisplayValue('Carvao Premium')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Pomada modeladora')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'nao existe');

    expect(screen.getByText('Nenhum produto encontrado com essa busca.')).toBeInTheDocument();
  });

  it('lets client mode collapse existing catalog products and order status groups', async () => {
    const user = userEvent.setup();

    render(
      <TenantModuleManagementSection
        draft={buildDraft({
          modulesData: {
            professionals: [],
            appointmentServices: [],
            appointmentRequests: [],
            orders: [
              {
                id: 'order-1',
                customerName: 'Carlos',
                customerPhone: '5511999999999',
                deliveryType: 'pickup',
                total: 79.8,
                status: 'received',
                items: [{ name: 'Pomada', quantity: 2, unitPrice: 39.9, measurementUnit: 'unit', itemTotal: 79.8 }],
                notes: '',
              },
              {
                id: 'order-2',
                customerName: 'Marina',
                customerPhone: '5511988887777',
                deliveryType: 'delivery',
                total: 29.9,
                status: 'ready',
                items: [{ name: 'Escova', quantity: 1, unitPrice: 29.9, measurementUnit: 'unit', itemTotal: 29.9 }],
                notes: 'Entregar na recepcao',
              },
            ],
            products: [
              {
                id: 'product-1',
                name: 'Pomada modeladora',
                category: 'Finalizacao',
                price: 39.9,
                image: '',
                measurementUnit: 'unit',
                description: 'Fixacao media',
                active: true,
              },
            ],
          },
        })}
        onDraftChange={vi.fn()}
        moduleActions={{}}
        mode="client"
        permissions={{
          canViewCatalog: true,
          canEditCatalog: true,
          canViewOrders: true,
          canManageOrders: true,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Catalogo' }));

    expect(screen.getByDisplayValue('Pomada modeladora')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Minimizar produtos cadastrados/i }));
    expect(screen.queryByDisplayValue('Pomada modeladora')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Expandir produtos cadastrados/i }));
    expect(screen.getByDisplayValue('Pomada modeladora')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pedidos' }));

    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.queryByText('Marina')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Expandir grupo Prontos/i }));
    expect(screen.getByText('Marina')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Minimizar grupo Recebidos/i }));
    expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
  });

  it('requires inline double confirmation before archiving an order in client mode', async () => {
    const user = userEvent.setup();
    const deleteOrder = vi.fn().mockResolvedValue({ archived: true, id: 'order-1' });

    render(
      <TenantModuleManagementSection
        draft={buildDraft()}
        onDraftChange={vi.fn()}
        moduleActions={{ deleteOrder }}
        mode="client"
        permissions={{
          canViewOrders: true,
          canManageOrders: true,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Pedidos' }));
    await user.click(screen.getByRole('button', { name: /Excluir pedido Carlos/i }));

    expect(screen.getByText(/Deseja excluir mesmo este pedido/i)).toBeInTheDocument();
    expect(deleteOrder).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Confirmar exclusao do pedido Carlos/i }));

    await waitFor(() => {
      expect(deleteOrder).toHaveBeenCalledWith('order-1');
    });
  });

  it('filters and sorts client orders by customer, phone, item, and timestamps', async () => {
    const user = userEvent.setup();

    render(
      <TenantModuleManagementSection
        draft={buildDraft({
          modulesData: {
            professionals: [],
            appointmentServices: [],
            appointmentRequests: [],
            products: [],
            orders: [
              {
                id: 'order-1',
                customerName: 'Carlos',
                customerPhone: '5511999999999',
                deliveryType: 'pickup',
                total: 79.8,
                status: 'received',
                createdAt: '2026-06-01T09:00:00.000Z',
                receivedAt: '2026-06-01T09:00:00.000Z',
                items: [{ name: 'Pomada', quantity: 2, unitPrice: 39.9, measurementUnit: 'unit', itemTotal: 79.8 }],
                notes: '',
              },
              {
                id: 'order-2',
                customerName: 'Marina',
                customerPhone: '5511988887777',
                deliveryType: 'delivery',
                total: 29.9,
                status: 'ready',
                createdAt: '2026-06-01T10:30:00.000Z',
                receivedAt: '2026-06-01T10:32:00.000Z',
                readyAt: '2026-06-01T10:50:00.000Z',
                items: [{ name: 'Escova', quantity: 1, unitPrice: 29.9, measurementUnit: 'unit', itemTotal: 29.9 }],
                notes: 'Entregar na recepcao',
              },
              {
                id: 'order-3',
                customerName: 'Beatriz',
                customerPhone: '5511977776666',
                deliveryType: 'pickup',
                total: 45,
                status: 'received',
                createdAt: '2026-06-01T11:00:00.000Z',
                receivedAt: '2026-06-01T11:01:00.000Z',
                items: [{ name: 'Carvao Premium', quantity: 1, unitPrice: 45, measurementUnit: 'unit', itemTotal: 45 }],
                notes: '',
              },
            ],
          },
        })}
        onDraftChange={vi.fn()}
        moduleActions={{}}
        mode="client"
        permissions={{
          canViewOrders: true,
          canManageOrders: true,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Pedidos' }));

    expect(screen.getAllByText('Recebido').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Criado em:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recebido em:/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Expandir grupo Prontos/i }));
    expect(screen.getByText('Pronto/Retirado')).toBeInTheDocument();
    expect(screen.getByText(/Pronto em:/i)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Buscar por cliente, telefone ou item/i);
    await user.type(searchInput, 'carvao');

    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
    expect(screen.queryByText('Marina')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, '8888');
    expect(screen.getByText('Marina')).toBeInTheDocument();
    expect(screen.queryByText('Carlos')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.selectOptions(screen.getByLabelText('Ordenar pedidos'), 'oldest');

    const receivedCards = screen.getAllByTestId('order-card-received');
    expect(within(receivedCards[0]).getByText('Carlos')).toBeInTheDocument();
    expect(within(receivedCards[1]).getByText('Beatriz')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Ordenar pedidos'), 'recent');

    const recentCards = screen.getAllByTestId('order-card-received');
    expect(within(recentCards[0]).getByText('Beatriz')).toBeInTheDocument();
    expect(within(recentCards[1]).getByText('Carlos')).toBeInTheDocument();
  });

  it('shows payment badges and lets authorized client operators mark manual payment as paid', async () => {
    const user = userEvent.setup();
    const updateOrderPaymentStatus = vi.fn().mockResolvedValue({ id: 'order-1', payment: { status: 'paid' } });

    render(
      <TenantModuleManagementSection
        draft={buildDraft()}
        onDraftChange={vi.fn()}
        moduleActions={{ updateOrderPaymentStatus }}
        mode="client"
        permissions={{
          canViewOrders: true,
          canManageOrders: true,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Pedidos' }));

    const receivedOrderCard = screen.getByTestId('order-card-received');
    expect(within(receivedOrderCard).getByText('Pix')).toBeInTheDocument();
    expect(within(receivedOrderCard).getByText('Pendente')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Expandir grupo Prontos/i }));
    const readyOrderCard = screen.getByTestId('order-card-ready');
    expect(within(readyOrderCard).getByText('Pago')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filtrar pagamento'), 'pending');
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.queryByText('Marina')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Marcar pagamento como pago/i }));

    await waitFor(() => {
      expect(updateOrderPaymentStatus).toHaveBeenCalledWith('order-1', 'paid');
    });
  });

  it('keeps the main admin mode behavior expanded without client-only collapse controls', async () => {
    const user = userEvent.setup();

    render(
      <TenantModuleManagementSection
        draft={buildDraft()}
        onDraftChange={vi.fn()}
        moduleActions={{}}
        mode="admin"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Pedidos' }));

    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('Marina')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Minimizar grupo Recebidos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir pedido Carlos/i })).not.toBeInTheDocument();
  });
});
