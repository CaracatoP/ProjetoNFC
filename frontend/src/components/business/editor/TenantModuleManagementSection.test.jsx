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
});
