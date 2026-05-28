import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BusinessCatalogSection } from './BusinessCatalogSection.jsx';

const modulesFixture = {
  catalog: true,
  cart: true,
  orders: true,
};

const productsFixture = [
  {
    id: 'product-1',
    name: 'Pomada modeladora',
    description: 'Fixacao media',
    price: 39.9,
    image: '',
    category: 'Finalizacao',
    measurementUnit: 'unit',
    active: true,
  },
  {
    id: 'product-2',
    name: 'Escova premium',
    description: 'Acabamento rapido',
    price: 24.9,
    image: '',
    category: '',
    measurementUnit: 'unit',
    active: true,
  },
  {
    id: 'product-3',
    name: 'Picanha',
    description: 'Corte bovino nobre',
    price: 59.9,
    image: '',
    category: 'Carnes',
    measurementUnit: 'kg',
    active: true,
  },
];

describe('BusinessCatalogSection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('groups products by category, restores the cart from localStorage, and clears it after a successful order', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue({ status: 'received' });
    const user = userEvent.setup();

    window.localStorage.setItem('taplink:cart:barbearia-estilo-vivo', JSON.stringify({ 'product-1': 2 }));

    render(
      <BusinessCatalogSection
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{
          catalogTitle: 'Servicos e produtos',
          catalogDescription: 'Catalogo do tenant',
        }}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Finalizacao' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Outros' })).toBeInTheDocument();
    expect(screen.getAllByText('Pomada modeladora').length).toBeGreaterThan(0);
    const cartTrigger = screen.getByRole('button', { name: /Abrir carrinho/i });
    expect(cartTrigger).toBeInTheDocument();
    expect(within(cartTrigger).getByText('2')).toBeInTheDocument();
    expect(window.localStorage.getItem('taplink:cart:barbearia-estilo-vivo')).toBe(JSON.stringify({ 'product-1': 2 }));

    await user.click(cartTrigger);
    expect(screen.getByRole('dialog', { name: /Seu pedido/i })).toBeInTheDocument();
    expect(screen.getByText('2 unidades x R$ 39,90/Unidade')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome'), 'Carlos');
    await user.type(screen.getByLabelText('Telefone'), '5511999999999');
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'Carlos',
          customerPhone: '5511999999999',
          items: [
            expect.objectContaining({
              productId: 'product-1',
              quantity: 2,
              measurementUnit: 'unit',
              displayQuantity: '2 unidades',
              itemTotal: 79.8,
            }),
          ],
        }),
      );
    });

    expect(window.localStorage.getItem('taplink:cart:barbearia-estilo-vivo')).toBeNull();
    expect(screen.getByRole('button', { name: /Abrir carrinho/i })).toBeInTheDocument();
  });

  it('requires customer name and phone before submitting and lets the shopper remove items from the cart panel', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue({ status: 'received' });
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const finalizacaoGroup = screen.getByRole('heading', { name: 'Finalizacao' }).closest('section, article, div');
    const finalizacaoCard = finalizacaoGroup?.parentElement?.querySelector('.catalog-card') || screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(finalizacaoCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    expect(onSubmitOrder).not.toHaveBeenCalled();
    expect(screen.getByText('Informe nome e telefone para finalizar o pedido.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Remover item Pomada modeladora/i }));
    expect(screen.getByText('Seu carrinho esta vazio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar produtos/i })).toBeInTheDocument();
  });

  it('opens and closes the dedicated cart panel from the fixed trigger', async () => {
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog', { name: /Seu pedido/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    const dialog = screen.getByRole('dialog', { name: /Seu pedido/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByTestId('catalog-cart-shell')).toBeInTheDocument();
    expect(within(dialog).getByTestId('catalog-cart-header')).toBeInTheDocument();
    expect(within(dialog).getByTestId('catalog-cart-body')).toBeInTheDocument();
    expect(within(dialog).getByTestId('catalog-cart-footer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Fechar carrinho/i }));
    expect(screen.queryByRole('dialog', { name: /Seu pedido/i })).not.toBeInTheDocument();
  });

  it('supports fractional kg products and submits proportional totals in the cart panel', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue({ status: 'received' });
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        tenantSlug="acougue-central"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const meatsSection = screen.getByRole('heading', { name: 'Carnes' }).closest('section');
    const picanhaCard = within(meatsSection).getByText('Picanha').closest('.catalog-card');

    await user.clear(within(picanhaCard).getByLabelText('Quantidade em gramas'));
    await user.type(within(picanhaCard).getByLabelText('Quantidade em gramas'), '400');
    await user.click(within(picanhaCard).getByRole('button', { name: 'Adicionar' }));

    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));

    expect(screen.getByText('400g x R$ 59,90/Kg')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 23,96').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Nome'), 'Patricia');
    await user.type(screen.getByLabelText('Telefone'), '5511988887777');
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              productId: 'product-3',
              quantity: 0.4,
              measurementUnit: 'kg',
              displayQuantity: '400g',
              itemTotal: 23.96,
            }),
          ],
        }),
      );
    });
  });
});
