import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';
import { formatCurrency, resolveMediaUrl } from '@/utils/formatters.js';

const CART_STORAGE_PREFIX = 'taplink:cart:';

function defaultCheckoutState() {
  return {
    customerName: '',
    customerPhone: '',
    deliveryType: 'pickup',
    address: '',
    notes: '',
  };
}

function getCartStorageKey(slug) {
  const normalizedSlug = String(slug || '').trim();
  return normalizedSlug ? `${CART_STORAGE_PREFIX}${normalizedSlug}` : '';
}

function readStoredCart(slug) {
  const storageKey = getCartStorageKey(slug);

  if (!storageKey || typeof window === 'undefined') {
    return {};
  }

  try {
    const storage = window.localStorage;

    if (!storage) {
      return {};
    }

    const rawValue = storage.getItem(storageKey);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([productId, quantity]) => [productId, Math.max(0, Number(quantity || 0))])
        .filter(([, quantity]) => quantity > 0),
    );
  } catch {
    return {};
  }
}

function persistStoredCart(slug, cart) {
  const storageKey = getCartStorageKey(slug);

  if (!storageKey || typeof window === 'undefined') {
    return;
  }

  const storage = window.localStorage;

  if (!storage) {
    return;
  }

  const normalizedEntries = Object.entries(cart || {}).filter(([, quantity]) => Number(quantity || 0) > 0);

  if (!normalizedEntries.length) {
    storage.removeItem(storageKey);
    return;
  }

  storage.setItem(storageKey, JSON.stringify(Object.fromEntries(normalizedEntries)));
}

function normalizeCategoryLabel(value) {
  return String(value || '').trim() || 'Outros';
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

export function BusinessCatalogSection({
  tenantSlug = '',
  modules,
  segmentConfig,
  products = [],
  onSubmitOrder,
  onTrackAction,
}) {
  const [cart, setCart] = useState({});
  const [checkout, setCheckout] = useState(defaultCheckoutState);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const hydratedSlugRef = useRef('');

  useEffect(() => {
    setCart(readStoredCart(tenantSlug));
    hydratedSlugRef.current = tenantSlug;
  }, [tenantSlug]);

  useEffect(() => {
    if (hydratedSlugRef.current !== tenantSlug) {
      return;
    }

    persistStoredCart(tenantSlug, cart);
  }, [cart, tenantSlug]);

  const groupedProducts = useMemo(() => {
    const groups = new Map();

    products.forEach((product) => {
      const category = normalizeCategoryLabel(product.category);

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category).push(product);
    });

    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items,
    }));
  }, [products]);

  const cartItems = useMemo(
    () =>
      products
        .filter((product) => Number(cart[product.id] || 0) > 0)
        .map((product) => ({
          productId: product.id,
          name: product.name,
          quantity: Number(cart[product.id] || 0),
          unitPrice: Number(product.price || 0),
          notes: '',
        })),
    [cart, products],
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cartItems],
  );

  const cartTotal = cartSubtotal;

  if (!products.length) {
    return null;
  }

  function updateCartQuantity(productId, quantity) {
    setCart((current) => {
      const nextQuantity = Math.max(0, Number(quantity || 0));

      if (!nextQuantity) {
        const { [productId]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [productId]: nextQuantity,
      };
    });
  }

  async function handleSubmitOrder(event) {
    event.preventDefault();

    const customerName = checkout.customerName.trim();
    const customerPhone = normalizePhoneDigits(checkout.customerPhone);

    if (!cartItems.length) {
      setFeedback('Adicione pelo menos um item antes de finalizar o pedido.');
      return;
    }

    if (!customerName || customerPhone.length < 8) {
      setFeedback('Informe nome e telefone para finalizar o pedido.');
      return;
    }

    setSubmitting(true);
    setFeedback('');

    try {
      await onSubmitOrder?.({
        customerName,
        customerPhone,
        items: cartItems,
        deliveryType: checkout.deliveryType,
        address: checkout.deliveryType === 'delivery' ? checkout.address.trim() : '',
        notes: checkout.notes.trim(),
      });
      onTrackAction?.({
        eventType: 'cta_click',
        targetType: 'order_submit',
        targetLabel: 'Finalizar pedido',
        sectionType: 'catalog',
      });
      setCart({});
      setCheckout(defaultCheckoutState());
      persistStoredCart(tenantSlug, {});
      setFeedback('Pedido enviado com sucesso.');
    } catch (error) {
      setFeedback(error?.message || 'Nao foi possivel enviar o pedido agora.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="section-card">
      <SectionHeader
        eyebrow="Modulo ativo"
        title={segmentConfig?.catalogTitle || 'Catalogo'}
        description={segmentConfig?.catalogDescription || 'Confira os itens publicados por este tenant.'}
      />

      <div className="catalog-groups">
        {groupedProducts.map((group) => (
          <section key={group.category} className="catalog-category-group">
            <div className="catalog-category-group__header">
              <h3>{group.category}</h3>
              <span>{group.items.length} item(ns)</span>
            </div>

            <div className="catalog-grid">
              {group.items.map((product) => {
                const imageUrl = resolveMediaUrl(product.image, {
                  width: 720,
                  height: 720,
                  fit: 'fill',
                });

                return (
                  <article key={product.id} className="catalog-card">
                    {imageUrl ? (
                      <div className="catalog-card__media">
                        <img src={imageUrl} alt={product.name} width="720" height="720" loading="lazy" decoding="async" />
                      </div>
                    ) : null}
                    <div className="catalog-card__content">
                      <div className="catalog-card__header">
                        <h3>{product.name}</h3>
                        <strong>{formatCurrency(product.price)}</strong>
                      </div>
                      <span className="admin-section-chip admin-section-chip--muted">{group.category}</span>
                      {product.description ? <p>{product.description}</p> : null}
                      {modules.cart || modules.orders ? (
                        <div className="catalog-card__actions">
                          <Button
                            variant="secondary"
                            aria-label={`Diminuir quantidade de ${product.name}`}
                            onClick={() => updateCartQuantity(product.id, Number(cart[product.id] || 0) - 1)}
                          >
                            -
                          </Button>
                          <span>{cart[product.id] || 0}</span>
                          <Button
                            onClick={() => {
                              updateCartQuantity(product.id, Number(cart[product.id] || 0) + 1);
                              onTrackAction?.({
                                eventType: 'link_click',
                                targetType: 'cart_add',
                                targetLabel: product.name,
                                sectionType: 'catalog',
                              });
                            }}
                          >
                            Adicionar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {modules.cart || modules.orders ? (
        <form className="catalog-checkout" onSubmit={handleSubmitOrder}>
          <SectionHeader title="Carrinho e pedido" description="Finalize com nome e telefone para enviar ao time do tenant." />
          <ul className="catalog-checkout__list">
            {cartItems.length ? (
              cartItems.map((item) => (
                <li key={item.productId}>
                  <div>
                    <span>{item.quantity}x {item.name}</span>
                    <small>{formatCurrency(item.unitPrice)} por unidade</small>
                  </div>
                  <div className="catalog-checkout__item-actions">
                    <strong>{formatCurrency(item.quantity * item.unitPrice)}</strong>
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label={`Remover item ${item.name}`}
                      onClick={() => updateCartQuantity(item.productId, 0)}
                    >
                      Remover
                    </Button>
                  </div>
                </li>
              ))
            ) : (
              <li>Nenhum item no carrinho ainda.</li>
            )}
          </ul>
          <div className="catalog-checkout__summary">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(cartSubtotal)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(cartTotal)}</strong>
            </div>
          </div>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Nome</span>
              <input value={checkout.customerName} onChange={(event) => setCheckout((current) => ({ ...current, customerName: event.target.value }))} />
            </label>
            <label className="admin-field">
              <span>Telefone</span>
              <input value={checkout.customerPhone} onChange={(event) => setCheckout((current) => ({ ...current, customerPhone: event.target.value }))} />
            </label>
            <label className="admin-field">
              <span>Entrega</span>
              <select value={checkout.deliveryType} onChange={(event) => setCheckout((current) => ({ ...current, deliveryType: event.target.value }))}>
                <option value="pickup">Retirada</option>
                <option value="delivery">Entrega</option>
              </select>
            </label>
            {checkout.deliveryType === 'delivery' ? (
              <label className="admin-field">
                <span>Endereco</span>
                <input value={checkout.address} onChange={(event) => setCheckout((current) => ({ ...current, address: event.target.value }))} />
              </label>
            ) : null}
          </div>
          <label className="admin-field">
            <span>Observacoes</span>
            <textarea rows="3" value={checkout.notes} onChange={(event) => setCheckout((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="catalog-checkout__footer">
            <strong>Total: {formatCurrency(cartTotal)}</strong>
            <Button type="submit" disabled={!cartItems.length || submitting}>
              {submitting ? 'Enviando...' : 'Enviar pedido'}
            </Button>
          </div>
          {feedback ? <p className="site-inline-feedback">{feedback}</p> : null}
        </form>
      ) : null}
    </Card>
  );
}
