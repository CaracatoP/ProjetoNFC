import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMeasurementDisplayQuantity,
  calculateMeasuredItemTotal,
  getMeasurementUnitLabel,
  isFractionalMeasurementUnit,
  normalizeProductMeasurement,
  requiresIntegerMeasurementQuantity,
} from '@shared/utils/productMeasurement.js';
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

function defaultFractionInputValue(measurementUnit) {
  switch (measurementUnit) {
    case 'kg':
      return '250';
    case 'g':
      return '100';
    case 'ml':
      return '500';
    case 'l':
      return '1';
    default:
      return '1';
  }
}

function getFractionInputConfig(measurementUnit) {
  switch (measurementUnit) {
    case 'kg':
      return {
        label: 'Quantidade em gramas',
        min: 50,
        step: 50,
        suffix: 'g',
        quickOptions: [250, 500, 1000, 2000],
      };
    case 'g':
      return {
        label: 'Quantidade em gramas',
        min: 1,
        step: 50,
        suffix: 'g',
        quickOptions: [],
      };
    case 'ml':
      return {
        label: 'Quantidade em ml',
        min: 50,
        step: 50,
        suffix: 'ml',
        quickOptions: [],
      };
    case 'l':
      return {
        label: 'Quantidade em litros',
        min: 0.1,
        step: 0.1,
        suffix: 'L',
        quickOptions: [],
      };
    default:
      return {
        label: 'Quantidade',
        min: 1,
        step: 1,
        suffix: '',
        quickOptions: [],
      };
  }
}

function parseFractionInputValue(rawValue) {
  return Number(String(rawValue || '').trim().replace(',', '.'));
}

function convertInputValueToCartQuantity(product, rawValue) {
  const numericValue = parseFractionInputValue(rawValue);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  switch (product.measurementUnit) {
    case 'kg':
      return Number((numericValue / 1000).toFixed(3));
    default:
      return numericValue;
  }
}

function normalizeCartQuantityForProduct(product, quantity) {
  const numericQuantity = Number(quantity || 0);

  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return 0;
  }

  if (requiresIntegerMeasurementQuantity(product.measurementUnit)) {
    return Math.max(0, Math.trunc(numericQuantity));
  }

  return Number(numericQuantity.toFixed(3));
}

function getCartAdjustmentStep(product) {
  const editorConfig = getCartEditorConfigForUnit(product.measurementUnit);

  if (requiresIntegerMeasurementQuantity(product.measurementUnit)) {
    return Number(editorConfig.step || 1);
  }

  return convertInputValueToCartQuantity(product, String(editorConfig.step || 1));
}

function getCartEditorConfigForUnit(measurementUnit) {
  if (measurementUnit === 'kg') {
    return {
      label: 'Quantidade em gramas',
      min: 50,
      step: 50,
    };
  }

  if (measurementUnit === 'g') {
    return {
      label: 'Quantidade em gramas',
      min: 1,
      step: 1,
    };
  }

  if (measurementUnit === 'ml') {
    return {
      label: 'Quantidade em ml',
      min: 1,
      step: 50,
    };
  }

  if (measurementUnit === 'l') {
    return {
      label: 'Quantidade em litros',
      min: 0.1,
      step: 0.1,
    };
  }

  return {
    label: 'Quantidade',
    min: 1,
    step: 1,
  };
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
  const [fractionInputs, setFractionInputs] = useState({});
  const [checkout, setCheckout] = useState(defaultCheckoutState);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const hydratedSlugRef = useRef('');
  const normalizedProducts = useMemo(
    () => (products || []).map((product) => normalizeProductMeasurement(product)),
    [products],
  );

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

    normalizedProducts.forEach((product) => {
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
  }, [normalizedProducts]);

  const cartItems = useMemo(
    () =>
      normalizedProducts
        .map((product) => ({
          product,
          quantity: normalizeCartQuantityForProduct(product, cart[product.id]),
        }))
        .filter(({ quantity }) => quantity > 0)
        .map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice: Number(product.price || 0),
          measurementUnit: product.measurementUnit,
          displayQuantity: buildMeasurementDisplayQuantity(quantity, product.measurementUnit),
          itemTotal: calculateMeasuredItemTotal(product.price, quantity),
          notes: '',
        })),
    [cart, normalizedProducts],
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.itemTotal, 0),
    [cartItems],
  );

  const cartTotal = cartSubtotal;
  const cartItemCount = cartItems.length;
  const cartBadgeCount = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + (requiresIntegerMeasurementQuantity(item.measurementUnit) ? Math.max(1, Number(item.quantity || 0)) : 1),
        0,
      ),
    [cartItems],
  );

  if (!normalizedProducts.length) {
    return null;
  }

  function updateCartQuantity(product, quantity) {
    setCart((current) => {
      const nextQuantity = normalizeCartQuantityForProduct(product, quantity);

      if (!nextQuantity) {
        const { [product.id]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [product.id]: nextQuantity,
      };
    });
  }

  function setFractionInput(productId, value) {
    setFractionInputs((current) => ({
      ...current,
      [productId]: value,
    }));
  }

  function getFractionInputValue(product) {
    return fractionInputs[product.id] ?? defaultFractionInputValue(product.measurementUnit);
  }

  function getCartEditorConfig(product) {
    const baseConfig = getCartEditorConfigForUnit(product.measurementUnit);

    if (product.measurementUnit === 'kg') {
      return {
        ...baseConfig,
        value: String(Math.round(Number(cart[product.id] || 0) * 1000)),
      };
    }

    if (requiresIntegerMeasurementQuantity(product.measurementUnit)) {
      return {
        ...baseConfig,
        value: String(Math.max(1, Math.trunc(Number(cart[product.id] || 0)))),
      };
    }

    return {
      ...baseConfig,
      value: String(Number(cart[product.id] || 0)),
    };
  }

  function addFractionalProductToCart(product) {
    const inputValue = getFractionInputValue(product);
    const quantityToAdd = convertInputValueToCartQuantity(product, inputValue);

    if (!quantityToAdd) {
      setFeedback('Informe uma quantidade valida para adicionar este produto.');
      return;
    }

    setFeedback('');
    updateCartQuantity(product, Number(cart[product.id] || 0) + quantityToAdd);
    onTrackAction?.({
      eventType: 'link_click',
      targetType: 'cart_add',
      targetLabel: product.name,
      sectionType: 'catalog',
    });
  }

  function handleCartEditorChange(product, rawValue) {
    const nextQuantity = convertInputValueToCartQuantity(product, rawValue);
    updateCartQuantity(product, nextQuantity);
  }

  function adjustCartQuantity(product, direction) {
    const currentQuantity = normalizeCartQuantityForProduct(product, cart[product.id]);
    const nextQuantity = currentQuantity + getCartAdjustmentStep(product) * direction;
    updateCartQuantity(product, nextQuantity);
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
      setFeedback('Pedido enviado com sucesso. Aguarde a confirmacao do tenant.');
      setIsCartOpen(true);
    } catch (error) {
      setFeedback(error?.message || 'Nao foi possivel enviar o pedido agora.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="section-card catalog-section">
      {modules.cart || modules.orders ? (
        <>
          <div className="catalog-cart-trigger">
            <Button type="button" variant="secondary" onClick={() => setIsCartOpen(true)} aria-label="Abrir carrinho">
              Carrinho
              <span className="catalog-cart-trigger__badge" aria-hidden="true">
                {cartBadgeCount}
              </span>
            </Button>
          </div>
          {isCartOpen ? (
            <div className="catalog-cart-layer">
              <button
                type="button"
                className="catalog-cart-layer__backdrop"
                aria-label="Fechar painel do carrinho"
                onClick={() => setIsCartOpen(false)}
              />
              <div className="catalog-cart-panel" role="dialog" aria-modal="true" aria-label="Seu pedido">
                <div className="catalog-cart-shell" data-testid="catalog-cart-shell">
                  <div className="catalog-cart-panel__header" data-testid="catalog-cart-header">
                    <div className="catalog-cart-panel__header-copy">
                      <span className="catalog-cart-panel__eyebrow" aria-hidden="true">
                        Carrinho
                      </span>
                      <strong>Seu pedido</strong>
                      <span>
                        {cartItemCount
                          ? `${cartItemCount} item(ns) selecionado(s). Revise antes de finalizar.`
                          : 'Escolha os produtos e finalize com nome e telefone.'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="catalog-cart-panel__close"
                      onClick={() => setIsCartOpen(false)}
                      aria-label="Fechar carrinho"
                    >
                      Fechar
                    </Button>
                  </div>

                  <form className="catalog-checkout catalog-checkout--drawer" onSubmit={handleSubmitOrder}>
                    <div className="catalog-cart-panel__body" data-testid="catalog-cart-body">
                      {feedback ? <p className="site-inline-feedback catalog-checkout__feedback">{feedback}</p> : null}

                      {cartItems.length ? (
                        <>
                          <ul className="catalog-checkout__list">
                            {cartItems.map((item) => {
                              const product = normalizedProducts.find((entry) => entry.id === item.productId) || {
                                id: item.productId,
                                measurementUnit: item.measurementUnit,
                                price: item.unitPrice,
                                name: item.name,
                                image: '',
                              };
                              const editorConfig = getCartEditorConfig(product);
                              const itemImageUrl = resolveMediaUrl(product.image, {
                                width: 160,
                                height: 160,
                                fit: 'fill',
                              });

                              return (
                                <li key={item.productId} className="catalog-checkout__item">
                                  <div className={`catalog-checkout__item-media${itemImageUrl ? '' : ' catalog-checkout__item-media--placeholder'}`}>
                                    {itemImageUrl ? <img src={itemImageUrl} alt={item.name} /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}
                                  </div>
                                  <div className="catalog-checkout__item-main">
                                    <div className="catalog-checkout__item-copy">
                                      <span className="catalog-checkout__item-name">{item.name}</span>
                                      <small className="catalog-checkout__item-meta">
                                        {item.displayQuantity} x {formatCurrency(item.unitPrice)}/{getMeasurementUnitLabel(item.measurementUnit)}
                                      </small>
                                    </div>

                                    <label className="catalog-checkout__item-editor">
                                      <span>{editorConfig.label}</span>
                                      <input
                                        type="number"
                                        min={editorConfig.min}
                                        step={editorConfig.step}
                                        value={editorConfig.value}
                                        onChange={(event) => handleCartEditorChange(product, event.target.value)}
                                      />
                                    </label>

                                    <div className="catalog-checkout__item-footer">
                                      <div className="catalog-checkout__stepper" aria-label={`Controles de quantidade para ${item.name}`}>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          className="catalog-checkout__stepper-button"
                                          aria-label={`Diminuir quantidade de ${item.name}`}
                                          onClick={() => adjustCartQuantity(product, -1)}
                                        >
                                          -
                                        </Button>
                                        <span className="catalog-checkout__stepper-value">{item.displayQuantity}</span>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          className="catalog-checkout__stepper-button"
                                          aria-label={`Aumentar quantidade de ${item.name}`}
                                          onClick={() => adjustCartQuantity(product, 1)}
                                        >
                                          +
                                        </Button>
                                      </div>
                                      <div className="catalog-checkout__item-actions">
                                        <strong>{formatCurrency(item.itemTotal)}</strong>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          aria-label={`Remover item ${item.name}`}
                                          onClick={() => updateCartQuantity(product, 0)}
                                        >
                                          Remover
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>

                          <div className="catalog-checkout__summary">
                            <div>
                              <span>Subtotal</span>
                              <strong>{formatCurrency(cartSubtotal)}</strong>
                            </div>
                            <div>
                              <span>Total parcial</span>
                              <strong>{formatCurrency(cartTotal)}</strong>
                            </div>
                          </div>

                          <div className="admin-form-grid catalog-checkout__fields">
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

                          <label className="admin-field catalog-checkout__notes">
                            <span>Observacoes</span>
                            <textarea rows="3" value={checkout.notes} onChange={(event) => setCheckout((current) => ({ ...current, notes: event.target.value }))} />
                          </label>
                        </>
                      ) : (
                        <div className="catalog-cart-empty">
                          <div className="catalog-cart-empty__icon" aria-hidden="true">
                            Carrinho
                          </div>
                          <strong>Seu carrinho esta vazio</strong>
                          <p>Adicione produtos do catalogo para montar o pedido antes de finalizar.</p>
                          <Button type="button" variant="secondary" onClick={() => setIsCartOpen(false)}>
                            Adicionar produtos
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="catalog-cart-panel__footer" data-testid="catalog-cart-footer">
                      <div className="catalog-cart-panel__total">
                        <span>Total do pedido</span>
                        <strong>{formatCurrency(cartTotal)}</strong>
                      </div>
                      <Button type="submit" disabled={!cartItems.length || submitting} className="catalog-cart-panel__submit">
                        {submitting ? 'Enviando...' : 'Finalizar pedido'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
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
                        <strong>
                          {formatCurrency(product.price)} / {getMeasurementUnitLabel(product.measurementUnit)}
                        </strong>
                      </div>
                      <span className="admin-section-chip admin-section-chip--muted">{group.category}</span>
                      {product.description ? <p>{product.description}</p> : null}
                      {modules.cart || modules.orders ? (
                        <div className="catalog-card__actions">
                          {isFractionalMeasurementUnit(product.measurementUnit) ? (
                            <div className="catalog-card__fractional">
                              <label className="admin-field">
                                <span>{getFractionInputConfig(product.measurementUnit).label}</span>
                                <input
                                  type="number"
                                  min={getFractionInputConfig(product.measurementUnit).min}
                                  step={getFractionInputConfig(product.measurementUnit).step}
                                  value={getFractionInputValue(product)}
                                  onChange={(event) => setFractionInput(product.id, event.target.value)}
                                />
                              </label>
                              {getFractionInputConfig(product.measurementUnit).quickOptions.length ? (
                                <div className="catalog-card__quick-actions">
                                  {getFractionInputConfig(product.measurementUnit).quickOptions.map((quickValue) => (
                                    <Button
                                      key={`${product.id}-${quickValue}`}
                                      type="button"
                                      variant="secondary"
                                      onClick={() => setFractionInput(product.id, String(quickValue))}
                                    >
                                      {product.measurementUnit === 'kg' && quickValue >= 1000
                                        ? `${quickValue / 1000}kg`
                                        : `${quickValue}${getFractionInputConfig(product.measurementUnit).suffix}`}
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="catalog-card__fractional-footer">
                                <span>
                                  No carrinho: {buildMeasurementDisplayQuantity(cart[product.id] || 0, product.measurementUnit) || '0'}
                                </span>
                                <Button type="button" onClick={() => addFractionalProductToCart(product)}>
                                  Adicionar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                aria-label={`Diminuir quantidade de ${product.name}`}
                                onClick={() => updateCartQuantity(product, Number(cart[product.id] || 0) - 1)}
                              >
                                -
                              </Button>
                              <span>{cart[product.id] || 0}</span>
                              <Button
                                type="button"
                                onClick={() => {
                                  updateCartQuantity(product, Number(cart[product.id] || 0) + 1);
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
                            </>
                          )}
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
    </Card>
  );
}
