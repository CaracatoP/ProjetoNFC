import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BusinessCatalogSection } from './BusinessCatalogSection.jsx';
import { PAYMENT_METHODS, PAYMENT_STATUS } from '@shared/constants/index.js';

const modulesFixture = {
  catalog: true,
  cart: true,
  orders: true,
};

const businessFixture = {
  id: 'business-1',
  slug: 'barbearia-estilo-vivo',
  name: 'Barbearia Estilo Vivo',
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
      key: 'pix@example.com',
      merchantName: 'Barbearia Estilo Vivo',
      merchantCity: 'Sao Paulo',
    },
    provider: 'manual',
  },
};

const legacyCashBusinessFixture = {
  ...businessFixture,
  paymentSettings: {
    enabled: true,
    methods: {
      cash: true,
    },
    provider: 'manual',
  },
};

const asaasBusinessFixture = {
  ...businessFixture,
  paymentSettings: {
    enabled: true,
    provider: 'asaas',
    methods: {
      pix: true,
      creditCard: true,
      debitCard: true,
      cashOnPickup: true,
      cashOnDelivery: true,
    },
    pix: {
      key: 'pix@asaas.local',
      merchantName: 'Barbearia Estilo Vivo',
      merchantCity: 'Sao Paulo',
    },
    asaas: {
      enabled: true,
      connected: true,
      hasApiKey: true,
      walletId: 'wallet_sub_123',
      accountEmail: 'financeiro@cliente.local',
      accountName: 'Barbearia Estilo Vivo',
      status: 'active',
    },
  },
};

const asaasCentralizedPublicFixture = {
  ...businessFixture,
  paymentSettings: {
    enabled: true,
    provider: 'asaas',
    methods: {
      pix: true,
      creditCard: true,
      debitCard: true,
      cashOnPickup: true,
      cashOnDelivery: true,
    },
    pix: {
      key: 'pix@asaas.local',
      merchantName: 'Barbearia Estilo Vivo',
      merchantCity: 'Sao Paulo',
    },
    asaas: {
      enabled: true,
      connected: false,
      hasApiKey: false,
      walletId: '',
      accountEmail: '',
      accountName: '',
      status: 'active',
    },
  },
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
    isAvailable: true,
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
    isAvailable: true,
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
    isAvailable: true,
    active: true,
  },
];

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function buildOrderSuccess(overrides = {}) {
  const { payment: paymentOverrides = {}, ...restOverrides } = overrides;

  return {
    id: 'order-test-1',
    status: 'received',
    total: 39.9,
    ...restOverrides,
    payment: {
      method: PAYMENT_METHODS.CASH_ON_PICKUP,
      status: PAYMENT_STATUS.MANUAL,
      provider: 'manual',
      amount: 39.9,
      ...paymentOverrides,
    },
  };
}

describe('BusinessCatalogSection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('groups products by category, restores the cart from localStorage, and clears it after a successful order', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue(buildOrderSuccess({ total: 79.8, payment: { amount: 79.8 } }));
    const user = userEvent.setup();

    window.localStorage.setItem('taplink:cart:barbearia-estilo-vivo', JSON.stringify({ 'product-1': 2 }));

    render(
      <BusinessCatalogSection
        business={businessFixture}
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
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: 'Pagamento na retirada' }));
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

    await waitFor(() => {
      expect(window.localStorage.getItem('taplink:cart:barbearia-estilo-vivo')).toBeNull();
    });
    expect(screen.getByRole('button', { name: /Abrir carrinho/i })).toBeInTheDocument();
  });

  it('requires customer name and phone before submitting and lets the shopper remove items from the cart panel', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue(buildOrderSuccess());
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={businessFixture}
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

    expect(screen.getByText('Revise os campos destacados antes de continuar.')).toBeInTheDocument();
    expect(screen.getAllByText('Informe seu nome.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Informe seu telefone.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Escolha entrega ou retirada.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toHaveFocus();
    });
    expect(onSubmitOrder).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Nome'), 'Carlos');
    expect(screen.queryByText('Informe seu nome.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Remover item Pomada modeladora/i }));
    expect(screen.getByText('Seu carrinho esta vazio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar produtos/i })).toBeInTheDocument();
  });

  it('shows visual checkout errors for missing payment and delivery address without submitting', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue(buildOrderSuccess());
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={businessFixture}
        tenantSlug="acougue-central"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.type(screen.getByLabelText('Nome'), 'Marina');
    await user.type(screen.getByLabelText('Telefone'), '5511987654321');
    await user.click(screen.getByRole('button', { name: 'Entrega' }));
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    expect(screen.getByText('Revise os campos destacados antes de continuar.')).toBeInTheDocument();
    expect(screen.getAllByText('Informe o endereco para entrega.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Escolha uma forma de pagamento.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Endereco')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmitOrder).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Endereco'), 'Rua das Carnes, 123');
    expect(screen.queryByText('Informe o endereco para entrega.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pix/i }));
    await waitFor(() => {
      expect(screen.queryByText('Revise os campos destacados antes de continuar.')).not.toBeInTheDocument();
    });
  });

  it('shows a specific visual error for an invalid phone and keeps the request blocked', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue(buildOrderSuccess({ payment: { method: PAYMENT_METHODS.PIX, status: PAYMENT_STATUS.PENDING, amount: 39.9, pixCopyPaste: '000201010212' } }));
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={businessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.type(screen.getByLabelText('Nome'), 'Carlos');
    await user.type(screen.getByLabelText('Telefone'), '12');
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: /Pix/i }));
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    expect(screen.getByText('Revise os campos destacados antes de continuar.')).toBeInTheDocument();
    expect(screen.getAllByText('Informe um telefone valido.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Telefone')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => {
      expect(screen.getByLabelText('Telefone')).toHaveFocus();
    });
    expect(onSubmitOrder).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Telefone'));
    await user.type(screen.getByLabelText('Telefone'), '11987654321');

    await waitFor(() => {
      expect(screen.queryByText('Informe um telefone valido.')).not.toBeInTheDocument();
    });
  });

  it('opens and closes the dedicated cart panel from the fixed trigger', async () => {
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={businessFixture}
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
    const onSubmitOrder = vi.fn().mockResolvedValue(buildOrderSuccess({ total: 23.96, payment: { amount: 23.96 } }));
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={{
          ...businessFixture,
          slug: 'acougue-central',
          name: 'Acougue Central',
          paymentSettings: {
            ...businessFixture.paymentSettings,
            pix: {
              key: 'pix@acougue.local',
              merchantName: 'Acougue Central',
              merchantCity: 'Sao Paulo',
            },
          },
        }}
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
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: 'Pagamento na retirada' }));
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

  it('filters catalog products locally and shows a friendly empty state for search misses', async () => {
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={{
          ...businessFixture,
          slug: 'acougue-central',
          name: 'Acougue Central',
        }}
        tenantSlug="acougue-central"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/Buscar produto, categoria ou descricao/i);
    expect(screen.getByRole('heading', { name: 'Finalizacao' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Carnes' })).toBeInTheDocument();

    await user.type(searchInput, 'picanha');

    expect(screen.getByText('Picanha')).toBeInTheDocument();
    expect(screen.queryByText('Pomada modeladora')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Finalizacao' })).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'nao existe');

    expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument();
    expect(screen.getByText(/Tente buscar por outro nome, categoria ou descricao/i)).toBeInTheDocument();
  });

  it('shows payment method cards, submits Pix orders with the selected method, and renders the Pix QR after success', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    const onSubmitOrder = vi.fn().mockResolvedValue({
      id: 'order-10',
      total: 59.9,
      payment: {
        method: PAYMENT_METHODS.PIX,
        status: PAYMENT_STATUS.PENDING,
        provider: 'manual',
        amount: 59.9,
        pixCopyPaste:
          '00020126580014br.gov.bcb.pix0116pix@example.com520400005303986540559.905802BR5919Barbearia Estilo Vivo6009SAO PAULO62070503***6304ABCD',
      },
    });

    render(
      <BusinessCatalogSection
        business={businessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));

    expect(screen.queryByText('Forma de pagamento')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrega' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirada' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pix/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Nome'), 'Julia');
    await user.type(screen.getByLabelText('Telefone'), '5511977776666');

    await user.click(screen.getByRole('button', { name: 'Retirada' }));

    expect(screen.getByText('Como deseja pagar na retirada?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pagamento na retirada/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pagamento na entrega/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cartao de credito' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pix/i }));
    expect(screen.getByRole('button', { name: /Finalizar pedido/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          payment: {
            method: PAYMENT_METHODS.PIX,
          },
        }),
      );
    });

    expect((await screen.findAllByText('Pedido enviado com sucesso')).length).toBeGreaterThan(0);
    expect(screen.getByText('Pedido #order-10')).toBeInTheDocument();
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument();
    expect(screen.getAllByText(/Apos o pagamento, o estabelecimento confirmara seu pedido/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copiar codigo Pix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar mais produtos/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Copiar codigo Pix/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        '00020126580014br.gov.bcb.pix0116pix@example.com520400005303986540559.905802BR5919Barbearia Estilo Vivo6009SAO PAULO62070503***6304ABCD',
      );
    });

    await user.click(screen.getByRole('button', { name: /Adicionar mais produtos/i }));

    expect(screen.queryByRole('dialog', { name: /Seu pedido/i })).not.toBeInTheDocument();
    expect(screen.getByText('Pedido pendente')).toBeInTheDocument();
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Copiar Pix/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the CPF/CNPJ field only for Asaas Pix and preserves the value when the shopper switches payment methods', async () => {
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={asaasBusinessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={vi.fn()}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.click(screen.getByRole('button', { name: 'Retirada' }));

    expect(screen.queryByLabelText('CPF ou CNPJ')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pix' }));

    expect(screen.getByLabelText('CPF ou CNPJ')).toBeInTheDocument();
    expect(screen.getByText('Necessario para gerar o pagamento pelo Asaas.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('CPF ou CNPJ'), '52998224725');
    expect(screen.getByLabelText('CPF ou CNPJ')).toHaveValue('529.982.247-25');

    await user.click(screen.getByRole('button', { name: 'Pagamento na retirada' }));

    expect(screen.queryByLabelText('CPF ou CNPJ')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pix' }));

    expect(screen.getByLabelText('CPF ou CNPJ')).toHaveValue('529.982.247-25');
  });

  it('renders the CPF/CNPJ field for centralized Asaas Pix even when the public payload does not expose a connected subaccount', async () => {
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={asaasCentralizedPublicFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={vi.fn()}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));

    expect(screen.getByLabelText('CPF ou CNPJ')).toBeInTheDocument();
    expect(screen.getByText('Voce recebera o QR Code para pagamento.')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('blocks submit when the Asaas Pix document is missing or invalid', async () => {
    const user = userEvent.setup();
    const onSubmitOrder = vi.fn();

    render(
      <BusinessCatalogSection
        business={asaasBusinessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.type(screen.getByLabelText('Nome'), 'Julia');
    await user.type(screen.getByLabelText('Telefone'), '5511977776666');
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    expect(screen.getAllByText('Informe seu CPF ou CNPJ.').length).toBeGreaterThan(0);
    expect(onSubmitOrder).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('CPF ou CNPJ'), '11111111111');
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    expect(screen.getAllByText('CPF invalido.').length).toBeGreaterThan(0);
    expect(onSubmitOrder).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('CPF ou CNPJ'));
    await user.type(screen.getByLabelText('CPF ou CNPJ'), '11111111111111');
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    expect(screen.getAllByText('CNPJ invalido.').length).toBeGreaterThan(0);
    expect(onSubmitOrder).not.toHaveBeenCalled();
  });

  it('stops requiring the document when the shopper switches from Asaas Pix to manual pickup payment', async () => {
    const user = userEvent.setup();
    const onSubmitOrder = vi.fn().mockResolvedValue(buildOrderSuccess());

    render(
      <BusinessCatalogSection
        business={asaasBusinessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.type(screen.getByLabelText('Nome'), 'Julia');
    await user.type(screen.getByLabelText('Telefone'), '5511977776666');
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));
    await user.type(screen.getByLabelText('CPF ou CNPJ'), '11111111111');
    await user.click(screen.getByRole('button', { name: 'Pagamento na retirada' }));
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerDocument: '',
          payment: {
            method: PAYMENT_METHODS.CASH_ON_PICKUP,
          },
        }),
      );
    });

    expect(screen.queryByText('CPF invalido.')).not.toBeInTheDocument();
  });

  it('renders the Asaas Pix QR image returned by the backend and explains that confirmation is automatic', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    const onSubmitOrder = vi.fn().mockResolvedValue({
      id: 'order-asaas-pix-1',
      total: 39.9,
      payment: {
        method: PAYMENT_METHODS.PIX,
        status: PAYMENT_STATUS.PENDING,
        provider: 'asaas',
        amount: 39.9,
        pixCopyPaste: '000201010212asaaspixpayload',
        pixQrCode: 'data:image/png;base64,asaasqr123',
      },
    });

    render(
      <BusinessCatalogSection
        business={asaasBusinessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.type(screen.getByLabelText('Nome'), 'Julia');
    await user.type(screen.getByLabelText('Telefone'), '5511977776666');
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));
    await user.type(screen.getByLabelText('CPF ou CNPJ'), '52998224725');
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerDocument: '52998224725',
          payment: {
            method: PAYMENT_METHODS.PIX,
          },
        }),
      );
    });

    expect(await screen.findByAltText('QR Code Pix do Asaas')).toHaveAttribute(
      'src',
      'data:image/png;base64,asaasqr123',
    );
    await user.click(screen.getByRole('button', { name: /Copiar codigo Pix/i }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('000201010212asaaspixpayload');
    });
    expect(
      screen.getAllByText(
        /Assim que o pagamento for confirmado, o status do pedido sera atualizado automaticamente/i,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('redirects Asaas Pix checkout to the hosted invoice when the charge exists but the QR payload is unavailable', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const onSubmitOrder = vi.fn().mockResolvedValue({
      id: 'order-asaas-pix-fallback-1',
      total: 39.9,
      payment: {
        method: PAYMENT_METHODS.PIX,
        status: PAYMENT_STATUS.PENDING,
        provider: 'asaas',
        amount: 39.9,
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_pix_fallback',
        pixCopyPaste: '',
        pixQrCode: '',
      },
    });

    render(
      <BusinessCatalogSection
        business={asaasBusinessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.type(screen.getByLabelText('Nome'), 'Julia');
    await user.type(screen.getByLabelText('Telefone'), '5511977776666');
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));
    await user.type(screen.getByLabelText('CPF ou CNPJ'), '52998224725');
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerDocument: '52998224725',
          payment: {
            method: PAYMENT_METHODS.PIX,
          },
        }),
      );
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('https://sandbox.asaas.com/i/pay_pix_fallback', '_self');
    });

    expect(await screen.findByText('Abrir cobranca Pix')).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /Finalize o Pix no ambiente seguro do Asaas. Depois da confirmacao, o pedido sera atualizado automaticamente./i,
      ).length,
    ).toBeGreaterThan(0);

    openSpy.mockRestore();
  });

  it('shows a loading state during submit and recovers with visible feedback when the request fails', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    const onSubmitOrder = vi.fn().mockReturnValue(deferred.promise);

    render(
      <BusinessCatalogSection
        business={asaasBusinessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.type(screen.getByLabelText('Nome'), 'Julia');
    await user.type(screen.getByLabelText('Telefone'), '5511977776666');
    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    await user.click(screen.getByRole('button', { name: /Pix/i }));
    await user.type(screen.getByLabelText('CPF ou CNPJ'), '52998224725');
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    expect(screen.getByRole('button', { name: 'Finalizando...' })).toBeDisabled();

    deferred.reject(new Error('Nao foi possivel gerar o pagamento Pix neste momento.'));

    expect(
      (await screen.findAllByText('Nao foi possivel gerar o pagamento Pix neste momento.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Finalizar pedido/i })).toBeEnabled();
    expect(onSubmitOrder).toHaveBeenCalledOnce();
  });

  it('shows Asaas online payment cards and redirects hosted card checkout to the invoice URL', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const onSubmitOrder = vi.fn().mockResolvedValue({
      id: 'order-asaas-1',
      total: 39.9,
      payment: {
        method: PAYMENT_METHODS.CREDIT_CARD,
        status: PAYMENT_STATUS.PENDING,
        provider: 'asaas',
        amount: 39.9,
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
      },
    });

    render(
      <BusinessCatalogSection
        business={asaasBusinessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));

    await user.click(screen.getByRole('button', { name: 'Entrega' }));

    expect(screen.getByText('Como deseja pagar na entrega?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartao de credito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartao de debito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagamento na entrega' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagamento na retirada' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Pagamento seguro processado pelo Asaas/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Cartao de credito' }));
    await user.type(screen.getByLabelText('Nome'), 'Julia');
    await user.type(screen.getByLabelText('Telefone'), '5511977776666');
    await user.type(screen.getByLabelText('Endereco'), 'Rua Augusta, 100');
    await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          payment: {
            method: PAYMENT_METHODS.CREDIT_CARD,
          },
        }),
      );
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('https://sandbox.asaas.com/i/pay_123', '_self');
    });

    openSpy.mockRestore();
  });

  it('filters payment methods by delivery type and clears an invalid payment selection when switching', async () => {
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={businessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={vi.fn()}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));
    await user.type(screen.getByLabelText('Nome'), 'Julia');
    await user.type(screen.getByLabelText('Telefone'), '5511977776666');

    await user.click(screen.getByRole('button', { name: 'Entrega' }));
    await user.click(screen.getByRole('button', { name: 'Pagamento na entrega' }));

    expect(screen.getByRole('button', { name: 'Pagamento na entrega' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Retirada' }));

    expect(screen.getByText('Como deseja pagar na retirada?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagamento na entrega' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagamento na retirada' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders legacy cash methods with the correct manual option for each delivery type', async () => {
    const user = userEvent.setup();

    render(
      <BusinessCatalogSection
        business={legacyCashBusinessFixture}
        tenantSlug="barbearia-estilo-vivo"
        modules={modulesFixture}
        segmentConfig={{}}
        products={productsFixture}
        onSubmitOrder={vi.fn()}
      />,
    );

    const catalogCard = screen.getByText('Pomada modeladora').closest('.catalog-card');
    await user.click(within(catalogCard).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: /Abrir carrinho/i }));

    await user.click(screen.getByRole('button', { name: 'Entrega' }));
    expect(screen.getByRole('button', { name: 'Pagamento na entrega' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagamento na retirada' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retirada' }));
    expect(screen.getByRole('button', { name: 'Pagamento na retirada' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagamento na entrega' })).not.toBeInTheDocument();
  });

  it('keeps unavailable products visible, disables purchase controls, and clears stale cart entries for them', async () => {
    const unavailableProducts = [
      ...productsFixture,
      {
        id: 'product-4',
        name: 'Costela especial',
        description: 'Temporariamente fora da vitrine',
        price: 45.9,
        image: '',
        category: 'Carnes',
        measurementUnit: 'kg',
        isAvailable: false,
        active: true,
      },
    ];

    window.localStorage.setItem('taplink:cart:acougue-central', JSON.stringify({ 'product-4': 1 }));

    render(
      <BusinessCatalogSection
        business={{
          ...businessFixture,
          slug: 'acougue-central',
          name: 'Acougue Central',
        }}
        tenantSlug="acougue-central"
        modules={modulesFixture}
        segmentConfig={{}}
        products={unavailableProducts}
        onSubmitOrder={vi.fn()}
      />,
    );

    const meatsSection = screen.getByRole('heading', { name: 'Carnes' }).closest('section');
    const unavailableCard = within(meatsSection).getByText('Costela especial').closest('.catalog-card');

    expect(unavailableCard).toHaveClass('catalog-card--unavailable');
    expect(within(unavailableCard).getAllByText('Indisponivel').length).toBeGreaterThan(0);
    expect(within(unavailableCard).getByRole('button', { name: 'Indisponivel' })).toBeDisabled();

    await waitFor(() => {
      expect(window.localStorage.getItem('taplink:cart:acougue-central')).toBeNull();
    });

    const cartTrigger = screen.getByRole('button', { name: /Abrir carrinho/i });
    expect(within(cartTrigger).getByText('0')).toBeInTheDocument();
  });
});
