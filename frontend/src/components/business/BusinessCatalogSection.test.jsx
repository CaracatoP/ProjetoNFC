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
    active: true,
  },
  {
    id: 'product-2',
    name: 'Escova premium',
    description: 'Acabamento rapido',
    price: 24.9,
    image: '',
    category: '',
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
    expect(screen.getByText('2x Pomada modeladora')).toBeInTheDocument();
    expect(window.localStorage.getItem('taplink:cart:barbearia-estilo-vivo')).toBe(JSON.stringify({ 'product-1': 2 }));

    await user.type(screen.getByLabelText('Nome'), 'Carlos');
    await user.type(screen.getByLabelText('Telefone'), '5511999999999');
    await user.click(screen.getByRole('button', { name: /Enviar pedido/i }));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'Carlos',
          customerPhone: '5511999999999',
          items: [
            expect.objectContaining({
              productId: 'product-1',
              quantity: 2,
            }),
          ],
        }),
      );
    });

    expect(window.localStorage.getItem('taplink:cart:barbearia-estilo-vivo')).toBeNull();
    expect(screen.getByText('Nenhum item no carrinho ainda.')).toBeInTheDocument();
  });

  it('requires customer name and phone before submitting and lets the shopper remove items', async () => {
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
    await user.click(screen.getByRole('button', { name: /Enviar pedido/i }));

    expect(onSubmitOrder).not.toHaveBeenCalled();
    expect(screen.getByText('Informe nome e telefone para finalizar o pedido.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Remover item Pomada modeladora/i }));
    expect(screen.getByText('Nenhum item no carrinho ainda.')).toBeInTheDocument();
  });
});
