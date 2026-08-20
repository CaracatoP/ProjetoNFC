import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_VALUES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUS,
} from '@shared/constants/index.js';
import {
  isBusinessPaymentMethodEnabled,
  normalizeBusinessPaymentSettings,
} from '@shared/utils/businessPayment.js';
import {
  buildMeasurementDisplayQuantity,
  calculateMeasuredItemTotal,
  getMeasurementUnitLabel,
  isFractionalMeasurementUnit,
  normalizeProductMeasurement,
  requiresIntegerMeasurementQuantity,
} from '@shared/utils/productMeasurement.js';
import { sumMoneyValues } from '@shared/utils/money.js';
import {
  normalizeProductAvailability,
  normalizeProductInventory,
} from '@shared/utils/productInventory.js';
import {
  formatCustomerDocument,
  normalizeCustomerDocument,
  validateCustomerDocument,
} from '@shared/utils/customerDocument.js';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { formatCurrency, resolveMediaUrl } from '@/utils/formatters.js';
import './BusinessCatalogSection.css';

const CART_STORAGE_PREFIX = 'taplink:cart:';
const PENDING_PIX_STORAGE_PREFIX = 'taplink:pending-pix:';
const ALL_CATEGORIES_VALUE = '__all__';
const MOBILE_CHECKOUT_MEDIA_QUERY = '(max-width: 768px)';

function logCheckoutEvent(eventName, context = {}) {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test' || typeof console === 'undefined') {
    return;
  }

  const sanitizedContext = Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined && value !== ''),
  );

  console.info(`[checkout] ${eventName}`, sanitizedContext);
}

function buildCheckoutErrorMessage(error) {
  if (error?.code === 'timeout_error') {
    return 'A solicitação demorou mais do que o esperado. Tente novamente em instantes.';
  }

  if (error?.code === 'network_error') {
    return 'Não foi possível conectar com a API para concluir o pedido.';
  }

  if (error?.code === 'asaas_unavailable') {
    return 'Não foi possível gerar o pagamento Pix neste momento.';
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return 'Não foi possível criar o pedido.';
}

function buildPendingPixRecoveryErrorMessage(error) {
  if (error?.code === 'timeout_error') {
    return 'O pagamento existe, mas não conseguimos retomar agora. Tente novamente em instantes.';
  }

  if (error?.code === 'network_error') {
    return 'Não foi possível conectar para retomar o pagamento. Verifique sua conexão e tente novamente.';
  }

  if (error?.code === 'public_order_payment_not_found') {
    return 'Esse pagamento não está mais disponível para retomada.';
  }

  if (error?.code === 'public_order_payment_already_paid') {
    return 'Esse pagamento já foi confirmado.';
  }

  if (
    error?.code === 'public_order_payment_provider_unavailable' ||
    error?.code === 'public_order_payment_payload_unavailable'
  ) {
    return 'O pedido está pendente, mas não conseguimos carregar os dados do Pix agora. Tente novamente em instantes.';
  }

  if (error?.code === 'public_order_payment_scope_mismatch') {
    return 'Não foi possível recuperar este pagamento com segurança.';
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return 'Não foi possível retomar o pagamento agora. Tente novamente em instantes.';
}

function isPublicOrderPaymentNotFoundError(error) {
  return error?.code === 'public_order_payment_not_found' || Number(error?.status || 0) === 404;
}

function isTerminalRecoverablePixStatus(status) {
  return [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED].includes(status);
}

function isValidCheckoutResponse(order) {
  return Boolean(order?.id && order?.payment?.method && order?.payment?.status);
}

function defaultCheckoutState() {
  return {
    customerName: '',
    customerPhone: '',
    customerDocument: '',
    deliveryType: '',
    address: '',
    notes: '',
    paymentMethod: '',
  };
}

function getCartStorageKey(slug) {
  const normalizedSlug = String(slug || '').trim();
  return normalizedSlug ? `${CART_STORAGE_PREFIX}${normalizedSlug}` : '';
}

function getPendingPixStorageKey(slug) {
  const normalizedSlug = String(slug || '').trim();
  return normalizedSlug ? `${PENDING_PIX_STORAGE_PREFIX}${normalizedSlug}` : '';
}

function readStoredCart(slug) {
  const storageKey = getCartStorageKey(slug);

  if (!storageKey || typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage?.getItem(storageKey);

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

  const normalizedEntries = Object.entries(cart || {}).filter(([, quantity]) => Number(quantity || 0) > 0);

  if (!normalizedEntries.length) {
    window.localStorage?.removeItem(storageKey);
    return;
  }

  window.localStorage?.setItem(storageKey, JSON.stringify(Object.fromEntries(normalizedEntries)));
}

function readStoredPendingPixOrder(slug) {
  const storageKey = getPendingPixStorageKey(slug);

  if (!storageKey || typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage?.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    const checkoutToken = String(parsed?.checkoutToken || '').trim();
    const orderId = String(parsed?.orderId || '').trim();

    if (!checkoutToken) {
      return null;
    }

    return {
      checkoutToken,
      orderId,
    };
  } catch {
    return null;
  }
}

function persistStoredPendingPixOrder(slug, pendingOrder = null) {
  const storageKey = getPendingPixStorageKey(slug);

  if (!storageKey || typeof window === 'undefined') {
    return;
  }

  const checkoutToken = String(pendingOrder?.checkoutToken || '').trim();

  if (!checkoutToken) {
    window.localStorage?.removeItem(storageKey);
    return;
  }

  window.localStorage?.setItem(
    storageKey,
    JSON.stringify({
      checkoutToken,
      orderId: String(pendingOrder?.orderId || '').trim(),
    }),
  );
}

function normalizeCategoryLabel(value) {
  return String(value || '').trim() || 'Outros';
}

function normalizeSearchTerm(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesProductSearch(product, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    product?.name,
    normalizeCategoryLabel(product?.category),
    product?.description,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .join(' ');

  return haystack.includes(searchTerm);
}

function normalizeCatalogProduct(product = {}) {
  const normalizedProduct = normalizeProductMeasurement(product);

  return {
    ...normalizedProduct,
    isAvailable: normalizeProductAvailability(normalizedProduct.isAvailable),
    inventory: normalizeProductInventory(
      normalizedProduct.inventory,
      normalizedProduct.measurementUnit,
    ),
  };
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function isOnlineCheckoutMethod(method) {
  return (
    method === PAYMENT_METHODS.PIX ||
    method === PAYMENT_METHODS.CREDIT_CARD ||
    method === PAYMENT_METHODS.DEBIT_CARD
  );
}

function usesHostedCheckoutProvider(method, paymentSettings = {}, provider) {
  const normalizedSettings = normalizeBusinessPaymentSettings(paymentSettings);

  return (
    isOnlineCheckoutMethod(method) &&
    normalizedSettings.provider === provider &&
    isBusinessPaymentMethodEnabled(normalizedSettings, method)
  );
}

function isAsaasPaymentMethod(method, paymentSettings = {}) {
  return usesHostedCheckoutProvider(method, paymentSettings, PAYMENT_PROVIDERS.ASAAS);
}

function isPaymentMethodCompatibleWithDeliveryType(deliveryType, paymentMethod) {
  if (!deliveryType || !paymentMethod) {
    return false;
  }

  if (
    (deliveryType === 'delivery' && paymentMethod === PAYMENT_METHODS.CASH_ON_PICKUP) ||
    (deliveryType === 'pickup' && paymentMethod === PAYMENT_METHODS.CASH_ON_DELIVERY)
  ) {
    return false;
  }

  return true;
}

function getAvailablePaymentMethodsForDeliveryType(methods = [], deliveryType = '') {
  if (!deliveryType) {
    return [];
  }

  return methods.filter((method) => isPaymentMethodCompatibleWithDeliveryType(deliveryType, method));
}

function getPaymentSectionTitle(deliveryType) {
  return deliveryType === 'delivery'
    ? 'Como deseja pagar na entrega?'
    : 'Como deseja pagar na retirada?';
}

function getPaymentMethodDescription(method, paymentSettings = {}) {
  if (isAsaasPaymentMethod(method, paymentSettings)) {
    switch (method) {
      case PAYMENT_METHODS.PIX:
        return 'Você receberá o QR Code para pagamento.';
      case PAYMENT_METHODS.CREDIT_CARD:
      case PAYMENT_METHODS.DEBIT_CARD:
        return 'Pagamento seguro processado pelo Asaas.';
      default:
        break;
    }
  }

  switch (method) {
    case PAYMENT_METHODS.PIX:
      return 'Pague pelo QR Code ou copie o código Pix. O estabelecimento confirma manualmente depois.';
    case PAYMENT_METHODS.CASH_ON_PICKUP:
      return 'Você pagará no momento da retirada do pedido.';
    case PAYMENT_METHODS.CASH_ON_DELIVERY:
      return 'Você pagará no momento da entrega do pedido.';
    case PAYMENT_METHODS.CREDIT_CARD:
    case PAYMENT_METHODS.DEBIT_CARD:
      return 'Pagamento seguro processado pelo Asaas.';
    default:
      return '';
  }
}

function getPaymentMethodTag(method, paymentSettings = {}) {
  if (isAsaasPaymentMethod(method, paymentSettings)) {
    return method === PAYMENT_METHODS.PIX ? 'Online' : 'Checkout Asaas';
  }

  if (method === PAYMENT_METHODS.CASH_ON_PICKUP || method === PAYMENT_METHODS.CASH_ON_DELIVERY) {
    return 'Manual';
  }

  return 'Disponível';
}

function getPaymentSuccessMessage(payment = {}) {
  const method = payment?.method;
  const provider = payment?.provider;
  const status = payment?.status;

  if (status === PAYMENT_STATUS.PAID) {
    return 'Pagamento confirmado. O estabelecimento já recebeu a confirmação desta cobrança.';
  }

  if (status === PAYMENT_STATUS.FAILED || status === PAYMENT_STATUS.CANCELLED) {
    return 'Esta cobrança não pode mais ser concluída. Revise o pedido para tentar novamente.';
  }

  switch (method) {
    case PAYMENT_METHODS.PIX:
      return provider === PAYMENT_PROVIDERS.ASAAS
        ? 'Pagamento Pix aguardando confirmação. Assim que o pagamento for confirmado, o status do pedido será atualizado automaticamente.'
        : 'Pedido enviado com sucesso. Após o pagamento, o estabelecimento confirmará seu pedido.';
    case PAYMENT_METHODS.CASH_ON_DELIVERY:
      return 'Pedido enviado com sucesso. O pagamento será feito na entrega.';
    case PAYMENT_METHODS.CASH_ON_PICKUP:
    default:
      return 'Pedido enviado com sucesso. O pagamento será feito na retirada.';
  }
}

function getRecoverablePixStatusCopy(order = {}) {
  const status = order?.payment?.status;

  if (status === PAYMENT_STATUS.PAID) {
    return {
      title: 'Pagamento confirmado',
      description: 'Seu pedido já foi pago e aguardará a próxima atualização do estabelecimento.',
    };
  }

  if (status === PAYMENT_STATUS.FAILED || status === PAYMENT_STATUS.CANCELLED) {
    return {
      title: 'Pagamento indisponível',
      description: 'Essa cobrança não pode mais ser concluída. Revise o pedido antes de tentar novamente.',
    };
  }

  return {
    title: 'Pagamento pendente',
    description: 'Seu Pix continua disponível. Retome o pagamento quando quiser.',
  };
}

function isPixPayment(order) {
  return order?.payment?.method === PAYMENT_METHODS.PIX;
}

function isPixCheckoutResult(order) {
  return isPixPayment(order) && Boolean(order?.payment?.pixCopyPaste);
}

function isAsaasPixCheckoutResult(order) {
  return isPixCheckoutResult(order) && order?.payment?.provider === PAYMENT_PROVIDERS.ASAAS;
}

function isAsaasPixHostedFallback(order) {
  return (
    isPixPayment(order) &&
    order?.payment?.provider === PAYMENT_PROVIDERS.ASAAS &&
    !order?.payment?.pixCopyPaste &&
    Boolean(order?.payment?.invoiceUrl)
  );
}

function hasRecoverablePixPresentation(order) {
  if (!isPixPayment(order)) {
    return false;
  }

  if (order?.payment?.status && isTerminalRecoverablePixStatus(order.payment.status)) {
    return true;
  }

  return Boolean(order?.payment?.pixCopyPaste || order?.payment?.pixQrCode || order?.payment?.invoiceUrl);
}

function hasActionablePixPayment(order) {
  if (!isPixPayment(order)) {
    return false;
  }

  if (order?.payment?.status && isTerminalRecoverablePixStatus(order.payment.status)) {
    return true;
  }

  return Boolean(order?.payment?.pixCopyPaste || order?.payment?.pixQrCode || order?.payment?.invoiceUrl);
}

function requiresCheckoutCustomerDocument(checkout, paymentSettings = {}) {
  return (
    checkout?.paymentMethod === PAYMENT_METHODS.PIX &&
    usesHostedCheckoutProvider(checkout?.paymentMethod, paymentSettings, PAYMENT_PROVIDERS.ASAAS)
  );
}

function buildCheckoutValidationErrors(
  checkout,
  cartItems,
  checkoutPaymentMethods,
  { requiresCustomerDocument = false } = {},
) {
  const errors = {};
  const customerName = checkout.customerName.trim();
  const customerPhone = normalizePhoneDigits(checkout.customerPhone);

  if (!cartItems.length) {
    errors.cart = 'Adicione pelo menos um item antes de finalizar o pedido.';
  }

  if (!customerName) {
    errors.customerName = 'Informe seu nome.';
  }

  if (customerPhone.length < 8) {
    errors.customerPhone = customerPhone ? 'Informe um telefone válido.' : 'Informe seu telefone.';
  }

  if (requiresCustomerDocument) {
    const documentValidation = validateCustomerDocument(checkout.customerDocument, {
      required: true,
    });

    if (!documentValidation.isValid) {
      errors.customerDocument = documentValidation.message;
    }
  }

  if (!checkout.deliveryType) {
    errors.deliveryType = 'Escolha se deseja entrega ou retirada.';
  }

  if (checkout.deliveryType === 'delivery' && !checkout.address.trim()) {
    errors.address = 'Informe o endereço para entrega.';
  }

  if (checkoutPaymentMethods.length && (!checkout.paymentMethod || !checkoutPaymentMethods.includes(checkout.paymentMethod))) {
    errors.paymentMethod = 'Escolha uma forma de pagamento.';
  }

  if (!checkoutPaymentMethods.length) {
    errors.paymentMethod = 'Nenhuma forma de pagamento está disponível no momento.';
  }

  return errors;
}

function buildCheckoutFieldErrorsFromRequestError(
  error,
  checkout,
  { requiresCustomerDocument = false } = {},
) {
  if (!requiresCustomerDocument) {
    return {};
  }

  if (
    error?.code === 'order_customer_document_required' ||
    error?.code === 'order_customer_document_invalid'
  ) {
    return {
      customerDocument:
        String(error?.message || '').trim() ||
        validateCustomerDocument(checkout.customerDocument, { required: true }).message,
    };
  }

  const errorDetails = Array.isArray(error?.details) ? error.details : [];
  const documentFieldError = errorDetails.find((item) => {
    const normalizedField = String(item?.field || item?.path || '').trim();
    return normalizedField === 'customerDocument' || normalizedField === 'cpfCnpj';
  });

  if (!documentFieldError) {
    return {};
  }

  return {
    customerDocument:
      String(documentFieldError.message || error?.message || '').trim() ||
      validateCustomerDocument(checkout.customerDocument, { required: true }).message,
  };
}

function redirectToCheckoutUrl(url) {
  const normalizedUrl = String(url || '').trim();

  if (!normalizedUrl || typeof window === 'undefined') {
    return false;
  }

  if (typeof window.open === 'function') {
    window.open(normalizedUrl, '_self');
    return true;
  }

  if (window.location?.assign) {
    window.location.assign(normalizedUrl);
    return true;
  }

  return false;
}

function isMobileCheckoutViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(MOBILE_CHECKOUT_MEDIA_QUERY).matches;
}

function getCatalogQuantityConfig(measurementUnit) {
  switch (measurementUnit) {
    case 'kg':
      return {
        min: 250,
        step: 250,
        suffix: 'g',
        quickOptions: [250, 500, 1000, 2000],
        customLabel: 'Outra quantidade em gramas',
      };
    case 'g':
      return {
        min: 100,
        step: 100,
        suffix: 'g',
        quickOptions: [100, 250, 500, 1000],
        customLabel: 'Outra quantidade em gramas',
      };
    case 'ml':
      return {
        min: 300,
        step: 250,
        suffix: 'ml',
        quickOptions: [300, 500, 1000],
        customLabel: 'Outra quantidade em ml',
      };
    case 'l':
      return {
        min: 0.5,
        step: 0.5,
        suffix: 'L',
        quickOptions: [0.5, 1, 2],
        customLabel: 'Outra quantidade em litros',
      };
    default:
      return {
        min: 1,
        step: 1,
        suffix: '',
        quickOptions: [],
        customLabel: 'Outra quantidade',
      };
  }
}

function getCartQuantityConfig(measurementUnit) {
  switch (measurementUnit) {
    case 'kg':
      return {
        step: 50,
      };
    case 'g':
      return {
        step: 50,
      };
    case 'ml':
      return {
        step: 50,
      };
    case 'l':
      return {
        step: 0.1,
      };
    default:
      return {
        step: 1,
      };
  }
}

function defaultFractionInputValue(measurementUnit) {
  switch (measurementUnit) {
    case 'kg':
      return '250';
    case 'g':
      return '100';
    case 'ml':
      return '300';
    case 'l':
      return '0.5';
    default:
      return '1';
  }
}

function parseFractionInputValue(rawValue) {
  return Number(String(rawValue || '').trim().replace(',', '.'));
}

function getStepPrecision(stepValue) {
  const normalizedStep = String(stepValue ?? '').trim();
  const dotIndex = normalizedStep.indexOf('.');
  return dotIndex >= 0 ? normalizedStep.length - dotIndex - 1 : 0;
}

function formatFractionOptionLabel(measurementUnit, rawValue) {
  const numericValue = Number(rawValue || 0);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '';
  }

  if (measurementUnit === 'kg') {
    if (numericValue >= 1000 && numericValue % 1000 === 0) {
      return `${numericValue / 1000}kg`;
    }

    return `${numericValue}g`;
  }

  if (measurementUnit === 'g') {
    return `${numericValue}g`;
  }

  if (measurementUnit === 'ml') {
    return `${numericValue}ml`;
  }

  if (measurementUnit === 'l') {
    return `${numericValue}L`;
  }

  return String(rawValue);
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
  const config = getCartQuantityConfig(product.measurementUnit);

  if (requiresIntegerMeasurementQuantity(product.measurementUnit)) {
    return Number(config.step || 1);
  }

  return convertInputValueToCartQuantity(product, String(config.step || 1));
}

function getCheckoutVisualProgress(cartItems, checkout, isShowingCheckoutSuccess) {
  if (isShowingCheckoutSuccess) {
    return 'payment';
  }

  if (!cartItems.length) {
    return 'cart';
  }

  if (!checkout.deliveryType) {
    return 'delivery';
  }

  return 'payment';
}

function truncatePixCode(value, { head = 14, tail = 8 } = {}) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.length <= head + tail + 3) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, head)}...${normalizedValue.slice(-tail)}`;
}

export function BusinessCatalogSection({
  business = {},
  tenantSlug = '',
  modules = {},
  segmentConfig = {},
  products = [],
  onSubmitOrder,
  onRecoverPendingPixOrder,
  onCancelPendingPixOrder,
  onTrackAction,
}) {
  const [cart, setCart] = useState({});
  const [fractionInputs, setFractionInputs] = useState({});
  const [fractionInputModes, setFractionInputModes] = useState({});
  const [checkout, setCheckout] = useState(defaultCheckoutState);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES_VALUE);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [pendingPixReference, setPendingPixReference] = useState(null);
  const [pendingPixOrder, setPendingPixOrder] = useState(null);
  const [recoveringPendingPixOrder, setRecoveringPendingPixOrder] = useState(false);
  const [pendingPixRecoveryError, setPendingPixRecoveryError] = useState('');
  const [pendingPixActionFeedback, setPendingPixActionFeedback] = useState('');
  const [pendingPixCancelDialogOpen, setPendingPixCancelDialogOpen] = useState(false);
  const [cancellingPendingPixOrder, setCancellingPendingPixOrder] = useState(false);
  const [pixCopyFeedback, setPixCopyFeedback] = useState('');
  const [checkoutErrors, setCheckoutErrors] = useState({});
  const [isMobileViewport, setIsMobileViewport] = useState(isMobileCheckoutViewport);
  const [mobileCheckoutStep, setMobileCheckoutStep] = useState('cart');
  const hydratedSlugRef = useRef('');
  const pendingPixStorageReadyRef = useRef(false);
  const checkoutBodyRef = useRef(null);
  const checkoutFieldRefs = useRef({});

  const normalizedProducts = useMemo(
    () => (products || []).map((product) => normalizeCatalogProduct(product)),
    [products],
  );
  const normalizedSearch = useMemo(() => normalizeSearchTerm(searchValue), [searchValue]);
  const paymentSettings = useMemo(
    () => normalizeBusinessPaymentSettings(business?.paymentSettings || {}, business?.contact?.pix || {}),
    [business],
  );
  const availablePaymentMethods = useMemo(
    () => PAYMENT_METHOD_VALUES.filter((method) => isBusinessPaymentMethodEnabled(paymentSettings, method)),
    [paymentSettings],
  );
  const checkoutPaymentMethods = useMemo(
    () => getAvailablePaymentMethodsForDeliveryType(availablePaymentMethods, checkout.deliveryType),
    [availablePaymentMethods, checkout.deliveryType],
  );
  const requiresCustomerDocument = useMemo(
    () => requiresCheckoutCustomerDocument(checkout, paymentSettings),
    [checkout, paymentSettings],
  );

  function syncPendingPixOrderState(order, checkoutToken = '') {
    if (!isValidCheckoutResponse(order) || !isPixPayment(order)) {
      return null;
    }

    const normalizedCheckoutToken = String(checkoutToken || order?.checkoutToken || '').trim();
    const nextOrder = normalizedCheckoutToken
      ? {
          ...order,
          checkoutToken: normalizedCheckoutToken,
        }
      : { ...order };

    setPendingPixOrder(nextOrder);

    if (normalizedCheckoutToken && nextOrder?.payment?.status === PAYMENT_STATUS.PENDING) {
      setPendingPixReference({
        checkoutToken: normalizedCheckoutToken,
        orderId: String(nextOrder?.id || '').trim(),
      });
    } else {
      setPendingPixReference(null);
    }

    return nextOrder;
  }

  async function recoverPendingPixOrderReference(reference = pendingPixReference) {
    const checkoutToken = String(reference?.checkoutToken || '').trim();

    if (!checkoutToken || typeof onRecoverPendingPixOrder !== 'function') {
      return null;
    }

    setRecoveringPendingPixOrder(true);
    setPendingPixRecoveryError('');
    setPendingPixActionFeedback('');

    try {
      const order = await onRecoverPendingPixOrder(checkoutToken);

      if (!isValidCheckoutResponse(order) || !isPixPayment(order)) {
        throw new Error('Não foi possível retomar o pagamento agora.');
      }

      return syncPendingPixOrderState(order, checkoutToken);
    } catch (error) {
      if (isPublicOrderPaymentNotFoundError(error)) {
        setPendingPixReference(null);
        setPendingPixOrder(null);
        setPendingPixRecoveryError('');
        return null;
      }

      setPendingPixRecoveryError(buildPendingPixRecoveryErrorMessage(error));
      throw error;
    } finally {
      setRecoveringPendingPixOrder(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_CHECKOUT_MEDIA_QUERY);
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    setCart(readStoredCart(tenantSlug));
    hydratedSlugRef.current = tenantSlug;
    pendingPixStorageReadyRef.current = false;
    setCheckout(defaultCheckoutState());
    setCheckoutResult(null);
    setPendingPixReference(null);
    setPendingPixOrder(null);
    setRecoveringPendingPixOrder(false);
    setPendingPixRecoveryError('');
    setPendingPixActionFeedback('');
    setPendingPixCancelDialogOpen(false);
    setCancellingPendingPixOrder(false);
    setActiveCategory(ALL_CATEGORIES_VALUE);
    setPixCopyFeedback('');
    setCheckoutErrors({});
    setFeedback('');
    setMobileCheckoutStep('cart');
  }, [tenantSlug]);

  useEffect(() => {
    if (hydratedSlugRef.current !== tenantSlug) {
      return;
    }

    persistStoredCart(tenantSlug, cart);
  }, [cart, tenantSlug]);

  useEffect(() => {
    if (!pendingPixStorageReadyRef.current) {
      return;
    }

    persistStoredPendingPixOrder(tenantSlug, pendingPixReference);
  }, [pendingPixReference, tenantSlug]);

  useEffect(() => {
    const pendingOrderReference = readStoredPendingPixOrder(tenantSlug);
    setPendingPixReference(pendingOrderReference);

    if (!pendingOrderReference?.checkoutToken || typeof onRecoverPendingPixOrder !== 'function') {
      pendingPixStorageReadyRef.current = true;
      return undefined;
    }

    let active = true;
    pendingPixStorageReadyRef.current = true;
    setRecoveringPendingPixOrder(true);

    Promise.resolve(onRecoverPendingPixOrder(pendingOrderReference.checkoutToken))
      .then((order) => {
        if (!active) {
          return;
        }

        if (!isValidCheckoutResponse(order) || !isPixPayment(order)) {
          setPendingPixRecoveryError('Não foi possível retomar o pagamento agora. Tente novamente em instantes.');
          return;
        }

        setPendingPixOrder({
          ...order,
          checkoutToken: pendingOrderReference.checkoutToken,
        });
        setPendingPixRecoveryError('');

        if (order?.payment?.status === PAYMENT_STATUS.PENDING) {
          setPendingPixReference({
            checkoutToken: pendingOrderReference.checkoutToken,
            orderId: String(order?.id || pendingOrderReference.orderId || '').trim(),
          });
        } else if (isTerminalRecoverablePixStatus(order?.payment?.status)) {
          setPendingPixReference(null);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (isPublicOrderPaymentNotFoundError(error)) {
          setPendingPixReference(null);
          setPendingPixOrder(null);
          setPendingPixRecoveryError('');
          return;
        }

        setPendingPixRecoveryError(buildPendingPixRecoveryErrorMessage(error));
      })
      .finally(() => {
        if (active) {
          setRecoveringPendingPixOrder(false);
        }
      });

    return () => {
      active = false;
    };
  }, [onRecoverPendingPixOrder, tenantSlug]);

  useEffect(() => {
    if (!isCartOpen || typeof window === 'undefined') {
      return undefined;
    }

    const previousOverflow = window.document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsCartOpen(false);
      }
    };

    window.document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCartOpen]);

  useEffect(() => {
    const productsById = new Map(normalizedProducts.map((product) => [product.id, product]));
    const nextCart = {};
    let cartChanged = false;

    Object.entries(cart).forEach(([productId, quantity]) => {
      const product = productsById.get(productId);

      if (!product || product.isAvailable === false) {
        cartChanged = true;
        return;
      }

      const normalizedQuantity = normalizeCartQuantityForProduct(product, quantity);

      if (!normalizedQuantity) {
        cartChanged = true;
        return;
      }

      nextCart[productId] = normalizedQuantity;

      if (normalizedQuantity !== quantity) {
        cartChanged = true;
      }
    });

    if (!cartChanged && Object.keys(nextCart).length === Object.keys(cart).length) {
      return;
    }

    setCart(nextCart);

    if (Object.keys(cart).length) {
      setFeedback('Alguns itens indisponíveis foram removidos do carrinho.');
    }
  }, [cart, normalizedProducts]);

  useEffect(() => {
    setCheckout((current) => {
      if (!current.paymentMethod) {
        return current;
      }

      if (checkoutPaymentMethods.includes(current.paymentMethod)) {
        return current;
      }

      return {
        ...current,
        paymentMethod: '',
      };
    });
  }, [checkoutPaymentMethods]);

  const filteredProducts = useMemo(
    () =>
      normalizedProducts.filter((product) => {
        const matchesCategory =
          activeCategory === ALL_CATEGORIES_VALUE ||
          normalizeCategoryLabel(product.category) === activeCategory;

        return matchesCategory && matchesProductSearch(product, normalizedSearch);
      }),
    [activeCategory, normalizedProducts, normalizedSearch],
  );

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(normalizedProducts.map((product) => normalizeCategoryLabel(product.category))),
    );

    return [
      {
        value: ALL_CATEGORIES_VALUE,
        label: 'Todos',
      },
      ...categories.map((category) => ({
        value: category,
        label: category,
      })),
    ];
  }, [normalizedProducts]);

  const groupedProducts = useMemo(() => {
    const groups = new Map();

    filteredProducts.forEach((product) => {
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
  }, [filteredProducts]);

  const cartItems = useMemo(
    () =>
      normalizedProducts
        .map((product) => ({
          product,
          quantity: normalizeCartQuantityForProduct(product, cart[product.id]),
        }))
        .filter(({ product, quantity }) => quantity > 0 && product.isAvailable !== false)
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
    () => sumMoneyValues(cartItems.map((item) => item.itemTotal)),
    [cartItems],
  );

  const cartTotal = cartSubtotal;
  const cartItemCount = cartItems.length;
  const pendingPixCheckoutToken = String(
    pendingPixReference?.checkoutToken || pendingPixOrder?.checkoutToken || '',
  ).trim();
  const pendingPixDisplayOrder = pendingPixOrder && isPixPayment(pendingPixOrder) ? pendingPixOrder : null;
  const pendingPixDisplayStatus = pendingPixDisplayOrder?.payment?.status || '';
  const cartBadgeCount = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) =>
          sum + (requiresIntegerMeasurementQuantity(item.measurementUnit) ? Math.max(1, Number(item.quantity || 0)) : 1),
        0,
      ),
    [cartItems],
  );
  const hasCatalogProducts = normalizedProducts.length > 0;
  const hasFilteredProducts = groupedProducts.length > 0;
  const isShowingCheckoutSuccess = Boolean(checkoutResult);
  const isAsaasPixSuccess = isAsaasPixCheckoutResult(checkoutResult);
  const isMobileCheckout = isMobileViewport;
  const showPendingPixBanner = Boolean(
    !isCartOpen && (pendingPixCheckoutToken || (pendingPixDisplayOrder && isPixPayment(pendingPixDisplayOrder))),
  );
  const pendingPixStatusCopy = useMemo(
    () =>
      showPendingPixBanner
        ? pendingPixDisplayOrder
          ? getRecoverablePixStatusCopy(pendingPixDisplayOrder)
          : {
              title: 'Pagamento pendente',
              description: 'Encontramos um Pix pendente e vamos retomar a mesma cobranÃ§a quando vocÃª continuar.',
            }
        : null,
    [pendingPixDisplayOrder, showPendingPixBanner],
  );
  const checkoutVisualStep = getCheckoutVisualProgress(cartItems, checkout, isShowingCheckoutSuccess);
  const cartSummaryText = cartItems.length
    ? `${cartBadgeCount} ${cartBadgeCount === 1 ? 'item' : 'itens'} | ${formatCurrency(cartTotal)}`
    : 'Abrir carrinho';
  const categoryCount = Math.max(0, categoryOptions.length - 1);
  const submitDisabled = submitting || !cartItems.length || !checkout.deliveryType || !checkout.paymentMethod;
  const dialogEyebrow = isShowingCheckoutSuccess
    ? checkoutResult?.payment?.status === PAYMENT_STATUS.PAID
      ? 'Pagamento confirmado'
      : checkoutResult?.payment?.status === PAYMENT_STATUS.CANCELLED
      ? 'Pedido cancelado'
      : checkoutResult?.payment?.status === PAYMENT_STATUS.FAILED
      ? 'Pagamento indisponÃ­vel'
      : 'Pedido criado'
    : 'Seu pedido';
  const dialogTitle = isShowingCheckoutSuccess
    ? checkoutResult?.payment?.status === PAYMENT_STATUS.PAID
      ? 'Pagamento confirmado'
      : checkoutResult?.payment?.status === PAYMENT_STATUS.CANCELLED
      ? 'Pedido cancelado'
      : checkoutResult?.payment?.status === PAYMENT_STATUS.FAILED
      ? 'Pagamento indisponÃ­vel'
      : 'Pedido enviado'
    : 'Seu pedido';
  const canGoBack = Boolean(isMobileCheckout && !isShowingCheckoutSuccess && mobileCheckoutStep !== 'cart');
  const mobileStepIndex =
    mobileCheckoutStep === 'delivery'
      ? 2
      : mobileCheckoutStep === 'payment'
      ? 3
      : isShowingCheckoutSuccess
      ? 4
      : 1;
  const mobileStepLabel =
    mobileCheckoutStep === 'delivery'
      ? 'Recebimento'
      : mobileCheckoutStep === 'payment'
      ? 'Pagamento'
      : isShowingCheckoutSuccess
      ? 'Pedido'
      : 'Carrinho';

  useEffect(() => {
    if (!Object.keys(checkoutErrors).length) {
      return;
    }

    const nextErrors = buildCheckoutValidationErrors(checkout, cartItems, checkoutPaymentMethods, {
      requiresCustomerDocument,
    });
    setCheckoutErrors((current) => {
      const unresolvedErrors = Object.fromEntries(
        Object.entries(current).filter(([field]) => nextErrors[field]),
      );

      if (Object.keys(unresolvedErrors).length === Object.keys(current).length) {
        return current;
      }

      return unresolvedErrors;
    });
  }, [cartItems, checkout, checkoutErrors, checkoutPaymentMethods, requiresCustomerDocument]);

  useEffect(() => {
    if (!isCartOpen) {
      return;
    }

    if (isShowingCheckoutSuccess) {
      setMobileCheckoutStep('success');
      return;
    }

    setMobileCheckoutStep((current) =>
      current === 'cart' || current === 'delivery' || current === 'payment' ? current : 'cart',
    );
  }, [isCartOpen, isShowingCheckoutSuccess]);

  function focusFirstCheckoutError(errors) {
    const errorOrder = [
      'cart',
      'deliveryType',
      'address',
      'customerName',
      'customerPhone',
      'customerDocument',
      'paymentMethod',
    ];
    const firstErrorField = errorOrder.find((field) => errors[field]);
    const target = checkoutFieldRefs.current[firstErrorField] || checkoutBodyRef.current;

    if (!target) {
      return;
    }

    window.requestAnimationFrame(() => {
      target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      target.focus?.({ preventScroll: true });
    });
  }

  function updateCartQuantity(product, quantity) {
    if (product?.isAvailable === false) {
      setFeedback('Este produto está indisponível no momento.');
      return;
    }

    setCheckoutResult(null);
    setPixCopyFeedback('');
    setFeedback('');
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

  function setFractionInputMode(productId, mode) {
    setFractionInputModes((current) => ({
      ...current,
      [productId]: mode,
    }));
  }

  function getFractionInputValue(product) {
    return fractionInputs[product.id] ?? defaultFractionInputValue(product.measurementUnit);
  }

  function adjustFractionInput(product, direction) {
    const config = getCatalogQuantityConfig(product.measurementUnit);
    const currentValue = parseFractionInputValue(getFractionInputValue(product));
    const fallbackValue = parseFractionInputValue(defaultFractionInputValue(product.measurementUnit));
    const baseValue =
      Number.isFinite(currentValue) && currentValue > 0
        ? currentValue
        : fallbackValue;
    const step = Number(config.step || 1);
    const nextValue = Math.max(
      Number(config.min || step || 1),
      Number((baseValue + step * direction).toFixed(getStepPrecision(step))),
    );
    setFractionInput(product.id, String(nextValue));
  }

  function adjustCartQuantity(product, direction) {
    const currentQuantity = normalizeCartQuantityForProduct(product, cart[product.id]);
    const nextQuantity = currentQuantity + getCartAdjustmentStep(product) * direction;
    updateCartQuantity(product, nextQuantity);
  }

  function addFractionalProductToCart(product) {
    if (product?.isAvailable === false) {
      setFeedback('Este produto está indisponível no momento.');
      return;
    }

    const inputValue = getFractionInputValue(product);
    const quantityToAdd = convertInputValueToCartQuantity(product, inputValue);

    if (!quantityToAdd) {
      setFeedback('Informe uma quantidade válida para adicionar este produto.');
      return;
    }

    updateCartQuantity(product, Number(cart[product.id] || 0) + quantityToAdd);
    onTrackAction?.({
      eventType: 'link_click',
      targetType: 'cart_add',
      targetLabel: product.name,
      sectionType: 'catalog',
    });
  }

  function openCartPanel(step = 'cart') {
    setMobileCheckoutStep(step);
    setIsCartOpen(true);
  }

  function closeCartPanel() {
    setIsCartOpen(false);
  }

  function handleMobileStepBack() {
    if (mobileCheckoutStep === 'payment') {
      setMobileCheckoutStep('delivery');
      return;
    }

    if (mobileCheckoutStep === 'delivery') {
      setMobileCheckoutStep('cart');
      return;
    }

    closeCartPanel();
  }

  function handleMobileStepAdvance() {
    if (mobileCheckoutStep === 'cart') {
      setMobileCheckoutStep('delivery');
      return;
    }

    if (mobileCheckoutStep === 'delivery') {
      const deliveryErrors = {};

      if (!checkout.deliveryType) {
        deliveryErrors.deliveryType = 'Escolha se deseja entrega ou retirada.';
      }

      if (checkout.deliveryType === 'delivery' && !checkout.address.trim()) {
        deliveryErrors.address = 'Informe o endereço para entrega.';
      }

      if (Object.keys(deliveryErrors).length) {
        setCheckoutErrors((current) => ({
          ...current,
          ...deliveryErrors,
        }));
        focusFirstCheckoutError(deliveryErrors);
        return;
      }

      setMobileCheckoutStep('payment');
    }
  }

  async function handleSubmitOrder(event) {
    event.preventDefault();

    const customerName = checkout.customerName.trim();
    const customerPhone = normalizePhoneDigits(checkout.customerPhone);
    const checkoutContext = {
      tenantSlug,
      deliveryType: checkout.deliveryType || 'unset',
      paymentMethod: checkout.paymentMethod || 'unset',
      itemCount: cartItems.length,
      total: cartTotal,
    };

    logCheckoutEvent('checkout_submit_started', checkoutContext);

    const validationErrors = buildCheckoutValidationErrors(checkout, cartItems, checkoutPaymentMethods, {
      requiresCustomerDocument,
    });

    if (Object.keys(validationErrors).length) {
      setCheckoutErrors(validationErrors);
      setFeedback('');
      logCheckoutEvent('checkout_submit_failed', {
        ...checkoutContext,
        stage: 'validation',
        code: 'validation_error',
        invalidFields: Object.keys(validationErrors),
      });
      focusFirstCheckoutError(validationErrors);
      return;
    }

    setSubmitting(true);
    setFeedback('');
    setCheckoutErrors({});

    try {
      const createdOrder = await onSubmitOrder?.({
        customerName,
        customerPhone,
        customerDocument: requiresCustomerDocument
          ? normalizeCustomerDocument(checkout.customerDocument)
          : '',
        items: cartItems,
        deliveryType: checkout.deliveryType,
        address: checkout.deliveryType === 'delivery' ? checkout.address.trim() : '',
        notes: checkout.notes.trim(),
        payment: {
          method: checkout.paymentMethod,
        },
      });

      if (!isValidCheckoutResponse(createdOrder)) {
        throw new Error('Não foi possível concluir o checkout com segurança.');
      }

      onTrackAction?.({
        eventType: 'cta_click',
        targetType: 'order_submit',
        targetLabel: 'Finalizar pedido',
        sectionType: 'catalog',
      });

      const nextPayment = createdOrder?.payment || {};
      const shouldRedirectToHostedCheckout =
        nextPayment.provider === PAYMENT_PROVIDERS.ASAAS &&
        (
          nextPayment.method === PAYMENT_METHODS.CREDIT_CARD ||
          nextPayment.method === PAYMENT_METHODS.DEBIT_CARD ||
          (nextPayment.method === PAYMENT_METHODS.PIX && !nextPayment.pixCopyPaste)
        ) &&
        nextPayment.invoiceUrl;
      const nextPendingPixOrder = isPixPayment(createdOrder)
        ? {
            ...createdOrder,
            checkoutToken: String(createdOrder?.checkoutToken || '').trim(),
          }
        : null;

      setCart({});
      setCheckout(defaultCheckoutState());
      setCheckoutResult(createdOrder || null);
      setPendingPixActionFeedback('');
      setPendingPixRecoveryError('');
      setPendingPixCancelDialogOpen(false);
      if (nextPendingPixOrder) {
        syncPendingPixOrderState(nextPendingPixOrder, nextPendingPixOrder.checkoutToken);
      } else {
        setPendingPixReference(null);
        setPendingPixOrder(null);
      }
      persistStoredCart(tenantSlug, {});
      setFeedback('');
      setIsCartOpen(true);
      setMobileCheckoutStep('success');

      logCheckoutEvent('checkout_success', {
        ...checkoutContext,
        orderId: createdOrder.id,
        provider: nextPayment.provider || 'manual',
      });

      if (shouldRedirectToHostedCheckout) {
        redirectToCheckoutUrl(nextPayment.invoiceUrl);
      }
    } catch (error) {
      const requestFieldErrors = buildCheckoutFieldErrorsFromRequestError(error, checkout, {
        requiresCustomerDocument,
      });

      if (Object.keys(requestFieldErrors).length) {
        setCheckoutErrors(requestFieldErrors);
        setFeedback('Revise os campos destacados antes de continuar.');
        focusFirstCheckoutError(requestFieldErrors);
        return;
      }

      const errorMessage = buildCheckoutErrorMessage(error);
      logCheckoutEvent('checkout_submit_failed', {
        ...checkoutContext,
        stage: 'request',
        status: error?.status,
        code: error?.code || 'api_error',
        message: errorMessage,
      });
      setFeedback(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyPixCode(order = checkoutResult || pendingPixOrder) {
    const pixCode = order?.payment?.pixCopyPaste || '';

    if (!pixCode || !navigator?.clipboard?.writeText) {
      setPixCopyFeedback('Não foi possível copiar o código Pix neste dispositivo.');
      return;
    }

    try {
      await navigator.clipboard.writeText(pixCode);
      setPixCopyFeedback('Código Pix copiado.');
    } catch {
      setPixCopyFeedback('Não foi possível copiar o código Pix neste dispositivo.');
    }
  }

  function handleContinueShopping() {
    setCheckoutResult(null);
    setFeedback('');
    closeCartPanel();
    setMobileCheckoutStep('cart');

    if (pendingPixOrder?.payment?.status && isTerminalRecoverablePixStatus(pendingPixOrder.payment.status)) {
      setPendingPixOrder(null);
    }
  }

  async function handleResumePendingPixPayment() {
    const fallbackReference = pendingPixCheckoutToken
      ? {
          checkoutToken: pendingPixCheckoutToken,
          orderId: String(pendingPixDisplayOrder?.id || pendingPixReference?.orderId || '').trim(),
        }
      : null;

    if (!fallbackReference?.checkoutToken) {
      return;
    }

    setPendingPixActionFeedback('');

    try {
      const recoveredOrder = hasRecoverablePixPresentation(pendingPixDisplayOrder)
        ? pendingPixDisplayOrder
        : typeof onRecoverPendingPixOrder === 'function'
          ? await recoverPendingPixOrderReference(fallbackReference)
          : pendingPixDisplayOrder;

      if (!recoveredOrder) {
        setPendingPixActionFeedback('Esse pagamento não está mais disponível.');
        return;
      }

      if (!hasActionablePixPayment(recoveredOrder)) {
        setPendingPixActionFeedback(
          'O pedido está pendente, mas os dados do Pix ainda não estão disponíveis. Tente novamente em instantes.',
        );
        return;
      }

      setCheckoutResult(recoveredOrder);
      openCartPanel('success');
    } catch (error) {
      setPendingPixActionFeedback(buildPendingPixRecoveryErrorMessage(error));
    }
  }

  async function handleConfirmPendingPixCancellation() {
    const fallbackReference = pendingPixCheckoutToken
      ? {
          checkoutToken: pendingPixCheckoutToken,
          orderId: String(pendingPixDisplayOrder?.id || pendingPixReference?.orderId || '').trim(),
        }
      : null;

    if (!fallbackReference?.checkoutToken || typeof onCancelPendingPixOrder !== 'function') {
      return;
    }

    setCancellingPendingPixOrder(true);
    setPendingPixActionFeedback('');

    try {
      const cancelledOrder = await onCancelPendingPixOrder(fallbackReference.checkoutToken);

      if (!isValidCheckoutResponse(cancelledOrder) || !isPixPayment(cancelledOrder)) {
        throw new Error('Não foi possível cancelar o pedido agora.');
      }

      const nextOrder = {
        ...cancelledOrder,
        checkoutToken: fallbackReference.checkoutToken,
      };

      setPendingPixReference(null);
      setPendingPixOrder(nextOrder);
      setCheckoutResult(nextOrder);
      setPendingPixRecoveryError('');
      setPendingPixCancelDialogOpen(false);
      openCartPanel('success');
    } catch (error) {
      setPendingPixActionFeedback(
        typeof error?.message === 'string' && error.message.trim()
          ? error.message.trim()
          : 'Não foi possível cancelar o pedido agora. Tente novamente.',
      );
    } finally {
      setCancellingPendingPixOrder(false);
    }
  }

  const showCartReviewStep = !isMobileCheckout || mobileCheckoutStep === 'cart';
  const showDeliveryStep = !isMobileCheckout || mobileCheckoutStep === 'delivery';
  const showPaymentStep = !isMobileCheckout || mobileCheckoutStep === 'payment';

  return (
    <>
      {(modules.cart || modules.orders) ? (
        <>
          {!isMobileCheckout ? (
            <div className="catalog-cart-floating">
              <Button
                type="button"
                variant="secondary"
                className="catalog-cart-floating__button"
                onClick={() => openCartPanel(isShowingCheckoutSuccess ? 'success' : 'cart')}
                aria-label="Abrir carrinho"
              >
                <span className="catalog-cart-floating__copy">
                  <strong>Carrinho</strong>
                  <span>{cartSummaryText}</span>
                </span>
                <span className="catalog-cart-trigger__badge" aria-hidden="true">
                  {cartBadgeCount}
                </span>
              </Button>
            </div>
          ) : (
            <div className="catalog-cart-mobilebar">
              <Button
                type="button"
                className="catalog-cart-mobilebar__button"
                onClick={() => openCartPanel(isShowingCheckoutSuccess ? 'success' : 'cart')}
                aria-label="Abrir carrinho"
              >
                <span className="catalog-cart-mobilebar__copy">
                  <strong>{cartBadgeCount} {cartBadgeCount === 1 ? 'item' : 'itens'}</strong>
                  <span>{formatCurrency(cartTotal)}</span>
                </span>
                <span>{cartItems.length ? 'Ver pedido' : 'Abrir carrinho'}</span>
              </Button>
            </div>
          )}

          {isCartOpen ? (
            <div className="catalog-drawer-layer">
              <button
                type="button"
                className="catalog-drawer-layer__backdrop"
                aria-label="Fechar painel do carrinho"
                onClick={closeCartPanel}
              />
              <div className="catalog-drawer" role="dialog" aria-modal="true" aria-label="Seu pedido">
                <div className="catalog-drawer__shell" data-testid="catalog-cart-shell">
                  <div className="catalog-drawer__header" data-testid="catalog-cart-header">
                    {canGoBack ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="catalog-drawer__nav-button"
                        onClick={handleMobileStepBack}
                      >
                        Voltar
                      </Button>
                    ) : isMobileCheckout ? (
                      <span className="catalog-drawer__header-spacer" aria-hidden="true" />
                    ) : null}

                    <div className="catalog-drawer__header-copy">
                      <span className="catalog-drawer__eyebrow" aria-hidden="true">{dialogEyebrow}</span>
                      {!isShowingCheckoutSuccess && isMobileCheckout ? (
                        <small className="catalog-drawer__progress-copy">
                          {`${mobileStepIndex} de 3 | ${mobileStepLabel}`}
                        </small>
                      ) : null}
                      <strong>{dialogTitle}</strong>
                      <span>
                        {isShowingCheckoutSuccess
                          ? 'Revise o pagamento e acompanhe a confirmação do pedido.'
                          : cartItemCount
                          ? `${cartItemCount} ${cartItemCount === 1 ? 'item selecionado' : 'itens selecionados'} para este pedido.`
                          : 'Adicione produtos ao carrinho para continuar.'}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="catalog-drawer__close"
                      onClick={closeCartPanel}
                      aria-label="Fechar carrinho"
                    >
                      Fechar
                    </Button>
                  </div>

                  <form className="catalog-checkout catalog-checkout--drawer" onSubmit={handleSubmitOrder}>
                    <div className="catalog-drawer__body" data-testid="catalog-cart-body" ref={checkoutBodyRef}>
                      {feedback ? <p className="site-inline-feedback catalog-checkout__feedback">{feedback}</p> : null}

                      {Object.keys(checkoutErrors).length ? (
                        <div className="catalog-checkout__validation-summary" role="alert" tabIndex="-1">
                          <strong>Revise os campos destacados antes de continuar.</strong>
                          <span>Corrija os pontos abaixo para finalizar o pedido com segurança.</span>
                          <ul>
                            {Object.values(checkoutErrors).map((message) => (
                              <li key={message}>{message}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {!isShowingCheckoutSuccess && !isMobileCheckout ? (
                        <div className="catalog-checkout-progress" aria-label="Etapas do checkout">
                          {[
                            { key: 'cart', label: 'Carrinho' },
                            { key: 'delivery', label: 'Recebimento' },
                            { key: 'payment', label: 'Pagamento' },
                          ].map((step) => (
                            <div
                              key={step.key}
                              className={`catalog-checkout-progress__step${checkoutVisualStep === step.key ? ' is-active' : ''}`}
                            >
                              <i aria-hidden="true" />
                              <span>{step.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {isShowingCheckoutSuccess ? (
                        <div className="catalog-success-view" data-testid="catalog-checkout-success">
                          <div className="catalog-success-view__hero">
                            <span className="catalog-success-view__pill">
                              {checkoutResult?.payment?.status === PAYMENT_STATUS.PAID
                                ? 'Pagamento confirmado'
                                : checkoutResult?.payment?.status === PAYMENT_STATUS.CANCELLED
                                ? 'Pedido cancelado'
                                : checkoutResult?.payment?.status === PAYMENT_STATUS.FAILED
                                ? 'Pagamento indisponÃ­vel'
                                : 'Pedido enviado com sucesso'}
                            </span>
                            <div className="catalog-success-view__copy">
                              <strong>
                                {checkoutResult?.payment?.status === PAYMENT_STATUS.PAID
                                  ? 'Pagamento confirmado'
                                  : checkoutResult?.payment?.status === PAYMENT_STATUS.CANCELLED
                                  ? 'Pedido cancelado'
                                  : checkoutResult?.payment?.status === PAYMENT_STATUS.FAILED
                                  ? 'Pagamento indisponÃ­vel'
                                  : 'Pedido enviado com sucesso'}
                              </strong>
                              <p>{getPaymentSuccessMessage(checkoutResult?.payment)}</p>
                            </div>
                            <div className="catalog-success-view__meta">
                              <div className="catalog-success-view__meta-card">
                                <span>Pedido</span>
                                <strong>{`Pedido #${checkoutResult?.id || 'novo'}`}</strong>
                              </div>
                              <div className="catalog-success-view__meta-card">
                                <span>Status</span>
                                <strong>
                                  {checkoutResult?.payment?.status === PAYMENT_STATUS.PAID
                                    ? 'Pagamento confirmado'
                                    : checkoutResult?.payment?.status === PAYMENT_STATUS.CANCELLED
                                    ? 'Cancelado'
                                    : checkoutResult?.payment?.status === PAYMENT_STATUS.FAILED
                                    ? 'Indisponivel'
                                    : isPixPayment(checkoutResult)
                                    ? 'Aguardando pagamento'
                                    : 'Aguardando confirmação'}
                                </strong>
                              </div>
                            </div>
                          </div>

                          <div className="catalog-summary-card catalog-summary-card--success">
                            <div>
                              <span>Total do pedido</span>
                              <strong>{formatCurrency(checkoutResult?.payment?.amount || checkoutResult?.total || 0)}</strong>
                            </div>
                            <div>
                              <span>Forma de pagamento</span>
                              <strong>{PAYMENT_METHOD_LABELS[checkoutResult?.payment?.method] || 'Pagamento manual'}</strong>
                            </div>
                          </div>

                          {isPixPayment(checkoutResult) &&
                          ![PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.FAILED].includes(checkoutResult?.payment?.status) ? (
                            <div className="catalog-pix-result">
                              <div className="catalog-pix-result__qr">
                                <div className="catalog-pix-result__qr-frame">
                                  {checkoutResult?.payment?.provider === PAYMENT_PROVIDERS.ASAAS ? (
                                    checkoutResult?.payment?.pixQrCode ? (
                                      <img src={checkoutResult.payment.pixQrCode} alt="QR Code Pix do Asaas" />
                                    ) : (
                                      <div className="catalog-pix-result__qr-fallback">
                                        <strong>Abra a cobrança Pix</strong>
                                        <span>
                                          {isAsaasPixHostedFallback(checkoutResult)
                                            ? 'O QR Code será exibido no ambiente seguro do Asaas.'
                                            : 'Use o código Pix abaixo para concluir o pagamento.'}
                                        </span>
                                      </div>
                                    )
                                  ) : (
                                    <div aria-hidden="true">
                                      <QRCode value={checkoutResult.payment.pixCopyPaste} size={240} />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="catalog-pix-result__content">
                                <div className="catalog-pix-result__header">
                                  <strong>{checkoutResult?.payment?.pixCopyPaste ? 'Pix copia e cola' : 'Pagamento Pix'}</strong>
                                  <span>
                                    {checkoutResult?.payment?.pixCopyPaste
                                      ? 'Use o QR Code ou copie o código completo para pagar agora.'
                                      : 'Continue o pagamento pela cobrança segura do Asaas.'}
                                  </span>
                                </div>
                                {checkoutResult?.payment?.pixCopyPaste ? (
                                  <div className="catalog-pix-result__code">
                                    <span>Copia e cola Pix</span>
                                    <code>{truncatePixCode(checkoutResult.payment.pixCopyPaste)}</code>
                                    <details>
                                      <summary>Ver código completo</summary>
                                      <pre>{checkoutResult.payment.pixCopyPaste}</pre>
                                    </details>
                                  </div>
                                ) : null}
                                {!checkoutResult?.payment?.pixCopyPaste && checkoutResult?.payment?.invoiceUrl ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => redirectToCheckoutUrl(checkoutResult.payment.invoiceUrl)}
                                  >
                                    Abrir cobrança Pix
                                  </Button>
                                ) : null}
                                {checkoutResult?.payment?.pixCopyPaste && pixCopyFeedback ? (
                                  <p className="catalog-pix-result__feedback">{pixCopyFeedback}</p>
                                ) : null}
                                <p className="catalog-pix-result__note">
                                  {isAsaasPixSuccess
                                    ? 'Assim que o pagamento for confirmado, o status do pedido será atualizado automaticamente.'
                                    : isAsaasPixHostedFallback(checkoutResult)
                                    ? 'Finalize o Pix no ambiente seguro do Asaas. Depois da confirmação, o pedido será atualizado automaticamente.'
                                    : 'Após o pagamento, o estabelecimento confirmará seu pedido.'}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {checkoutResult?.payment?.method === PAYMENT_METHODS.CASH_ON_PICKUP ? (
                            <p className="admin-muted-copy">Você pagará no momento da retirada do pedido.</p>
                          ) : null}

                          {checkoutResult?.payment?.method === PAYMENT_METHODS.CASH_ON_DELIVERY ? (
                            <p className="admin-muted-copy">Você pagará no momento da entrega do pedido.</p>
                          ) : null}

                          <div className="catalog-checkout__success-actions">
                            {isPixPayment(checkoutResult) && checkoutResult?.payment?.status === PAYMENT_STATUS.PENDING ? (
                              <button
                                type="button"
                                className="catalog-inline-action catalog-inline-action--danger"
                                onClick={() => setPendingPixCancelDialogOpen(true)}
                              >
                                Cancelar pedido
                              </button>
                            ) : null}
                            <Button type="button" variant="secondary" onClick={handleContinueShopping}>
                              {checkoutResult?.payment?.status === PAYMENT_STATUS.CANCELLED
                                ? 'Voltar ao catalogo'
                                : 'Adicionar mais produtos'}
                            </Button>
                            <Button type="button" variant="secondary" onClick={closeCartPanel}>
                              Fechar
                            </Button>
                          </div>
                        </div>
                      ) : cartItems.length ? (
                        <>
                          {showCartReviewStep ? (
                            <section className="catalog-checkout-block">
                              <div className="catalog-checkout-block__header">
                                <strong>{isMobileCheckout ? 'Carrinho' : '1. Carrinho'}</strong>
                                <span>Revise os itens, ajuste as quantidades e confira o total do pedido.</span>
                              </div>
                              <ul className="catalog-cart-list">
                                {cartItems.map((item) => {
                                  const product = normalizedProducts.find((entry) => entry.id === item.productId) || {
                                    id: item.productId,
                                    measurementUnit: item.measurementUnit,
                                    price: item.unitPrice,
                                    name: item.name,
                                    image: '',
                                  };
                                  const itemImageUrl = resolveMediaUrl(product.image, {
                                    width: 160,
                                    height: 160,
                                    fit: 'fill',
                                  });

                                  return (
                                    <li key={item.productId} className="catalog-cart-item">
                                      <div className={`catalog-cart-item__media${itemImageUrl ? '' : ' catalog-cart-item__media--placeholder'}`}>
                                        {itemImageUrl ? <img src={itemImageUrl} alt={item.name} /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}
                                      </div>
                                      <div className="catalog-cart-item__main">
                                        <div className="catalog-cart-item__copy">
                                          <div>
                                            <span className="catalog-cart-item__name">{item.name}</span>
                                            <small className="catalog-cart-item__meta">
                                              {`${item.displayQuantity} x ${formatCurrency(item.unitPrice)}/${getMeasurementUnitLabel(item.measurementUnit)}`}
                                            </small>
                                          </div>
                                          <div className="catalog-cart-item__pricing">
                                            <span>Subtotal</span>
                                            <strong>{formatCurrency(item.itemTotal)}</strong>
                                          </div>
                                        </div>

                                        <div className="catalog-cart-item__footer">
                                          <div className="catalog-cart-item__stepper" aria-label={`Controles de quantidade para ${item.name}`}>
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              className="catalog-cart-item__stepper-button"
                                              aria-label={`Diminuir quantidade de ${item.name}`}
                                              onClick={() => adjustCartQuantity(product, -1)}
                                            >
                                              -
                                            </Button>
                                            <span className="catalog-cart-item__stepper-value">{item.displayQuantity}</span>
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              className="catalog-cart-item__stepper-button"
                                              aria-label={`Aumentar quantidade de ${item.name}`}
                                              onClick={() => adjustCartQuantity(product, 1)}
                                            >
                                              +
                                            </Button>
                                          </div>
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
                                    </li>
                                  );
                                })}
                              </ul>

                            </section>
                          ) : null}

                          {showDeliveryStep ? (
                            <section className="catalog-checkout-block">
                              <div className="catalog-checkout-block__header">
                                <strong>{isMobileCheckout ? 'Como você vai receber?' : '2. Como você vai receber?'}</strong>
                                <span>Escolha primeiro se o pedido será entregue ou retirado no estabelecimento.</span>
                              </div>

                              <div
                                ref={(node) => {
                                  checkoutFieldRefs.current.deliveryType = node;
                                }}
                                className={`catalog-checkout-choice-group${checkoutErrors.deliveryType ? ' catalog-checkout__choice-group--invalid' : ''}`}
                                role="group"
                                aria-labelledby="checkout-delivery-type-title"
                                aria-invalid={checkoutErrors.deliveryType ? 'true' : undefined}
                                aria-describedby={checkoutErrors.deliveryType ? 'checkout-delivery-type-error' : undefined}
                                tabIndex={checkoutErrors.deliveryType ? '-1' : undefined}
                              >
                                <div className="catalog-choice-card__grid catalog-choice-card__grid--delivery" id="checkout-delivery-type-title">
                                  {[
                                    {
                                      value: 'delivery',
                                      title: 'Entrega',
                                      description: 'Receber no endereço informado',
                                    },
                                    {
                                      value: 'pickup',
                                      title: 'Retirada',
                                      description: 'Buscar no estabelecimento',
                                    },
                                  ].map((option) => {
                                    const selected = checkout.deliveryType === option.value;

                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        className={`catalog-choice-card__option${selected ? ' is-selected' : ''}`}
                                        aria-label={option.title}
                                        aria-pressed={selected}
                                        onClick={() =>
                                          setCheckout((current) => {
                                            const nextPaymentMethods = getAvailablePaymentMethodsForDeliveryType(
                                              availablePaymentMethods,
                                              option.value,
                                            );

                                            return {
                                              ...current,
                                              deliveryType: option.value,
                                              address: option.value === 'delivery' ? current.address : '',
                                              paymentMethod: nextPaymentMethods.includes(current.paymentMethod)
                                                ? current.paymentMethod
                                                : '',
                                            };
                                          })
                                        }
                                      >
                                        <div className="catalog-choice-card__copy">
                                          <strong>{option.title}</strong>
                                          <span>{option.description}</span>
                                        </div>
                                        <i aria-hidden="true" />
                                      </button>
                                    );
                                  })}
                                </div>
                                {checkoutErrors.deliveryType ? <small id="checkout-delivery-type-error" className="catalog-checkout__choice-error">{checkoutErrors.deliveryType}</small> : null}
                              </div>

                              {checkout.deliveryType === 'delivery' ? (
                                <label className={`admin-field catalog-checkout__address${checkoutErrors.address ? ' admin-field--invalid' : ''}`}>
                                  <span>Endereço</span>
                                  <input
                                    ref={(node) => {
                                      checkoutFieldRefs.current.address = node;
                                    }}
                                    value={checkout.address}
                                    onChange={(event) => setCheckout((current) => ({ ...current, address: event.target.value }))}
                                    aria-label="Endereço"
                                    aria-invalid={checkoutErrors.address ? 'true' : undefined}
                                    aria-describedby={checkoutErrors.address ? 'checkout-address-error' : undefined}
                                  />
                                  {checkoutErrors.address ? <small id="checkout-address-error">{checkoutErrors.address}</small> : null}
                                </label>
                              ) : null}
                            </section>
                          ) : null}

                          {showPaymentStep ? (
                            <section className="catalog-checkout-block">
                              <div className="catalog-checkout-block__header">
                                <strong>
                                  {checkout.deliveryType
                                    ? getPaymentSectionTitle(checkout.deliveryType)
                                    : isMobileCheckout
                                    ? 'Como deseja pagar?'
                                    : '3. Pagamento e dados do pedido'}
                                </strong>
                                <span>
                                  {checkout.deliveryType
                                    ? 'Preencha seus dados e escolha uma forma de pagamento compatível com o recebimento.'
                                    : 'Escolha entrega ou retirada para liberar apenas as formas de pagamento compatíveis.'}
                                </span>
                              </div>

                              <div className="admin-form-grid catalog-checkout__fields">
                                <label className={`admin-field${checkoutErrors.customerName ? ' admin-field--invalid' : ''}`}>
                                  <span>Nome</span>
                                  <input
                                    ref={(node) => {
                                      checkoutFieldRefs.current.customerName = node;
                                    }}
                                    value={checkout.customerName}
                                    onChange={(event) => setCheckout((current) => ({ ...current, customerName: event.target.value }))}
                                    aria-label="Nome"
                                    aria-invalid={checkoutErrors.customerName ? 'true' : undefined}
                                    aria-describedby={checkoutErrors.customerName ? 'checkout-customer-name-error' : undefined}
                                  />
                                  {checkoutErrors.customerName ? <small id="checkout-customer-name-error">{checkoutErrors.customerName}</small> : null}
                                </label>
                                <label className={`admin-field${checkoutErrors.customerPhone ? ' admin-field--invalid' : ''}`}>
                                  <span>Telefone</span>
                                  <input
                                    ref={(node) => {
                                      checkoutFieldRefs.current.customerPhone = node;
                                    }}
                                    value={checkout.customerPhone}
                                    onChange={(event) => setCheckout((current) => ({ ...current, customerPhone: event.target.value }))}
                                    aria-label="Telefone"
                                    aria-invalid={checkoutErrors.customerPhone ? 'true' : undefined}
                                    aria-describedby={checkoutErrors.customerPhone ? 'checkout-customer-phone-error' : undefined}
                                  />
                                  {checkoutErrors.customerPhone ? <small id="checkout-customer-phone-error">{checkoutErrors.customerPhone}</small> : null}
                                </label>
                              </div>

                              <label className="admin-field catalog-checkout__notes">
                                <span>Observações</span>
                                <textarea rows="3" value={checkout.notes} onChange={(event) => setCheckout((current) => ({ ...current, notes: event.target.value }))} />
                              </label>

                              {requiresCustomerDocument ? (
                                <label className={`admin-field${checkoutErrors.customerDocument ? ' admin-field--invalid' : ''}`}>
                                  <span>CPF ou CNPJ</span>
                                  <input
                                    ref={(node) => {
                                      checkoutFieldRefs.current.customerDocument = node;
                                    }}
                                    value={checkout.customerDocument}
                                    onChange={(event) =>
                                      setCheckout((current) => ({
                                        ...current,
                                        customerDocument: formatCustomerDocument(event.target.value),
                                      }))
                                    }
                                    aria-label="CPF ou CNPJ"
                                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    aria-invalid={checkoutErrors.customerDocument ? 'true' : undefined}
                                    aria-describedby={
                                      checkoutErrors.customerDocument
                                        ? 'checkout-customer-document-error'
                                        : 'checkout-customer-document-help'
                                    }
                                  />
                                  {checkoutErrors.customerDocument ? (
                                    <small id="checkout-customer-document-error">{checkoutErrors.customerDocument}</small>
                                  ) : (
                                    <small id="checkout-customer-document-help">
                                      Necessário para gerar o pagamento pelo Asaas.
                                    </small>
                                  )}
                                </label>
                              ) : null}

                              {checkout.deliveryType ? (
                                <div
                                  ref={(node) => {
                                    checkoutFieldRefs.current.paymentMethod = node;
                                  }}
                                  className={`catalog-checkout-choice-group${checkoutErrors.paymentMethod ? ' catalog-checkout__choice-group--invalid' : ''}`}
                                  role="group"
                                  aria-labelledby="checkout-payment-methods-title"
                                  aria-invalid={checkoutErrors.paymentMethod ? 'true' : undefined}
                                  aria-describedby={checkoutErrors.paymentMethod ? 'checkout-payment-method-error' : undefined}
                                  tabIndex={checkoutErrors.paymentMethod ? '-1' : undefined}
                                >
                                  <div className="catalog-checkout-choice-grid" id="checkout-payment-methods-title">
                                    {checkoutPaymentMethods.map((method) => {
                                      const selected = checkout.paymentMethod === method;

                                      return (
                                        <button
                                          key={method}
                                          type="button"
                                          className={`catalog-choice-card__option${selected ? ' is-selected' : ''}`}
                                          aria-label={PAYMENT_METHOD_LABELS[method]}
                                          aria-pressed={selected}
                                          onClick={() =>
                                            setCheckout((current) => ({
                                              ...current,
                                              paymentMethod: method,
                                            }))
                                          }
                                        >
                                          <div className="catalog-choice-card__copy">
                                            <strong>{PAYMENT_METHOD_LABELS[method]}</strong>
                                            <span>{getPaymentMethodDescription(method, paymentSettings)}</span>
                                          </div>
                                          <span className="catalog-choice-card__tag">{getPaymentMethodTag(method, paymentSettings)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {checkoutErrors.paymentMethod ? <small id="checkout-payment-method-error" className="catalog-checkout__choice-error">{checkoutErrors.paymentMethod}</small> : null}
                                </div>
                              ) : (
                                <div className="catalog-payment-placeholder">
                                  <strong>Escolha entrega ou retirada primeiro</strong>
                                  <span>Depois disso, mostraremos apenas as formas de pagamento compatíveis com o seu pedido.</span>
                                </div>
                              )}
                            </section>
                          ) : null}
                        </>
                      ) : (
                        <div className="catalog-cart-empty">
                          <div className="catalog-cart-empty__icon" aria-hidden="true">
                            Carrinho
                          </div>
                          <strong>Seu carrinho está vazio</strong>
                          <p>Adicione produtos do catálogo para montar o pedido antes de finalizar.</p>
                          <Button type="button" variant="secondary" onClick={closeCartPanel}>
                            Adicionar produtos
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="catalog-drawer__footer" data-testid="catalog-cart-footer">
                      {isShowingCheckoutSuccess ? (
                        <div className="catalog-drawer__footer-success">
                          <div className="catalog-drawer__total catalog-drawer__total--compact">
                            <span>Total do pedido</span>
                            <strong>{formatCurrency(checkoutResult?.payment?.amount || checkoutResult?.total || 0)}</strong>
                          </div>
                          {isPixPayment(checkoutResult) &&
                          checkoutResult?.payment?.status === PAYMENT_STATUS.PENDING &&
                          checkoutResult?.payment?.pixCopyPaste ? (
                            <Button type="button" className="catalog-drawer__submit" onClick={() => handleCopyPixCode(checkoutResult)}>
                              Copiar código Pix
                            </Button>
                          ) : isAsaasPixHostedFallback(checkoutResult) ? (
                            <Button
                              type="button"
                              className="catalog-drawer__submit"
                              onClick={() => redirectToCheckoutUrl(checkoutResult.payment.invoiceUrl)}
                            >
                              Abrir cobrança Pix
                            </Button>
                          ) : (
                            <Button type="button" className="catalog-drawer__submit" onClick={closeCartPanel}>
                              Fechar
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="catalog-drawer__footer-main">
                          {feedback ? (
                            <p
                              className="site-inline-feedback catalog-checkout__footer-feedback"
                              role="alert"
                              aria-live="polite"
                            >
                              {feedback}
                            </p>
                          ) : null}
                          <div className="catalog-drawer__total">
                            <span>Total do pedido</span>
                            <strong>{formatCurrency(cartTotal)}</strong>
                          </div>
                          {isMobileCheckout && mobileCheckoutStep !== 'payment' ? (
                            <Button
                              type="button"
                              disabled={submitting || !cartItems.length}
                              className="catalog-drawer__submit"
                              onClick={handleMobileStepAdvance}
                            >
                              Continuar
                            </Button>
                          ) : (
                            <Button type="submit" disabled={submitDisabled} className="catalog-drawer__submit">
                              {submitting ? 'Finalizando...' : 'Finalizar pedido'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <Card className="section-card catalog-experience">
        <div className="catalog-experience__hero">
          <div className="catalog-experience__copy">
            <span className="catalog-experience__eyebrow">Módulo ativo</span>
            <h2>{segmentConfig?.catalogTitle || 'Catálogo'}</h2>
            <p>{segmentConfig?.catalogDescription || 'Confira os itens publicados por este estabelecimento.'}</p>
          </div>
          <div className="catalog-experience__stats">
            <div>
              <span>Produtos</span>
              <strong>{normalizedProducts.length}</strong>
            </div>
            <div>
              <span>Categorias</span>
              <strong>{categoryCount}</strong>
            </div>
          </div>
        </div>

        {recoveringPendingPixOrder && !showPendingPixBanner ? (
          <div className="catalog-payment-alert catalog-payment-alert--loading" role="status" aria-live="polite">
            <div className="catalog-payment-alert__copy">
              <strong>Retomando pagamento</strong>
              <span>Estamos verificando se existe um Pix pendente para este pedido.</span>
            </div>
          </div>
        ) : null}

        {showPendingPixBanner ? (
          <div className="catalog-payment-alert" role="status" aria-live="polite">
            <div className="catalog-payment-alert__copy">
              <span className="catalog-payment-alert__eyebrow">{pendingPixStatusCopy?.title || 'Pagamento pendente'}</span>
              <strong>{pendingPixDisplayOrder?.id ? `Pedido #${pendingPixDisplayOrder.id}` : 'Pagamento pendente'}</strong>
              <span>{pendingPixRecoveryError || pendingPixStatusCopy?.description || 'Seu Pix continua disponível para pagamento.'}</span>
            </div>
            <div className="catalog-payment-alert__meta">
              <span>Total</span>
              <strong>{formatCurrency(pendingPixDisplayOrder?.payment?.amount || pendingPixDisplayOrder?.total || 0)}</strong>
            </div>
            {pixCopyFeedback ? <small>{pixCopyFeedback}</small> : null}
            {!pixCopyFeedback && pendingPixActionFeedback ? <small>{pendingPixActionFeedback}</small> : null}
            <div className="catalog-payment-alert__actions">
              {pendingPixDisplayStatus === PAYMENT_STATUS.PENDING && pendingPixDisplayOrder?.payment?.pixCopyPaste ? (
                <Button type="button" variant="secondary" onClick={() => handleCopyPixCode(pendingPixDisplayOrder)}>
                  Copiar Pix
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={handleResumePendingPixPayment}>
                {pendingPixDisplayStatus === PAYMENT_STATUS.PENDING ? 'Continuar pagamento' : 'Ver pedido'}
              </Button>
              {pendingPixDisplayStatus === PAYMENT_STATUS.PENDING ? (
                <button
                  type="button"
                  className="catalog-inline-action catalog-inline-action--danger"
                  onClick={() => setPendingPixCancelDialogOpen(true)}
                >
                  Cancelar pedido
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <Modal
          open={pendingPixCancelDialogOpen}
          title="Cancelar este pedido?"
          onClose={() => {
            if (!cancellingPendingPixOrder) {
              setPendingPixCancelDialogOpen(false);
            }
          }}
        >
          <div className="catalog-cancel-dialog">
            <p>O pagamento pendente será encerrado e o pedido não será enviado ao estabelecimento.</p>
            {pendingPixActionFeedback ? <small>{pendingPixActionFeedback}</small> : null}
            <div className="catalog-cancel-dialog__actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingPixCancelDialogOpen(false)}
                disabled={cancellingPendingPixOrder}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="catalog-cancel-dialog__confirm"
                onClick={handleConfirmPendingPixCancellation}
                disabled={cancellingPendingPixOrder}
              >
                {cancellingPendingPixOrder ? 'Cancelando...' : 'Cancelar pedido'}
              </Button>
            </div>
          </div>
        </Modal>

        <div className="catalog-toolbar">
          <label className="admin-field catalog-search-field">
            <span>Buscar produto</span>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Buscar produto, categoria ou descrição"
            />
          </label>
          {hasCatalogProducts ? (
            <div className="catalog-category-tabs" aria-label="Filtrar por categoria">
              {categoryOptions.map((option) => {
                const selected = activeCategory === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`catalog-category-tabs__button${selected ? ' is-active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setActiveCategory(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {!hasCatalogProducts ? (
          <div className="catalog-search-empty catalog-search-empty--published">
            <strong>Nenhum produto cadastrado ainda</strong>
            <p>Os produtos deste estabelecimento aparecerão aqui assim que forem publicados.</p>
          </div>
        ) : hasFilteredProducts ? (
          <div className="catalog-groups">
            {groupedProducts.map((group) => (
              <section key={group.category} className="catalog-category-group">
                <div className="catalog-category-group__header">
                  <div>
                    <h3>{group.category}</h3>
                    <span>{group.items.length} {group.items.length === 1 ? 'item' : 'itens'}</span>
                  </div>
                </div>

                <div className="catalog-grid">
                  {group.items.map((product) => {
                    const imageUrl = resolveMediaUrl(product.image, {
                      width: 720,
                      height: 560,
                      fit: 'fill',
                    });
                    const productIsAvailable = product.isAvailable !== false;
                    const cartQuantity = Number(cart[product.id] || 0);
                    const isFractional = isFractionalMeasurementUnit(product.measurementUnit);
                    const quantityConfig = getCatalogQuantityConfig(product.measurementUnit);
                    const fractionInputValue = getFractionInputValue(product);
                    const fractionalPreviewQuantity = convertInputValueToCartQuantity(product, fractionInputValue);
                    const fractionalPreviewTotal = fractionalPreviewQuantity
                      ? calculateMeasuredItemTotal(product.price, fractionalPreviewQuantity)
                      : 0;
                    const showCustomQuantityInput =
                      isFractional && fractionInputModes[product.id] === 'custom';

                    return (
                      <article
                        key={product.id}
                        className={`catalog-card catalog-product-card${productIsAvailable ? '' : ' catalog-card--unavailable'}`}
                      >
                        <div className="catalog-product-card__media">
                          {imageUrl ? (
                            <img src={imageUrl} alt={product.name} width="720" height="560" loading="lazy" decoding="async" />
                          ) : (
                            <div className="catalog-product-card__media-placeholder" aria-hidden="true">
                              {product.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="catalog-product-card__measure">
                            {getMeasurementUnitLabel(product.measurementUnit)}
                          </span>
                          {!productIsAvailable ? (
                            <span className="catalog-product-card__status">Indisponível</span>
                          ) : null}
                        </div>

                        <div className="catalog-product-card__body">
                          <div className="catalog-product-card__header">
                            <div className="catalog-product-card__copy">
                              <span className="catalog-product-card__category">{group.category}</span>
                              <h3>{product.name}</h3>
                            </div>
                            <strong className="catalog-product-card__price">
                              {formatCurrency(product.price)} / {getMeasurementUnitLabel(product.measurementUnit)}
                            </strong>
                          </div>

                          {product.description ? (
                            <p className="catalog-product-card__description">{product.description}</p>
                          ) : null}

                          {modules.cart || modules.orders ? (
                            <div className="catalog-product-card__purchase">
                              {!productIsAvailable ? (
                                <div className="catalog-product-card__disabled">
                                  <span>Produto indisponível no momento.</span>
                                  <Button type="button" disabled>
                                    Indisponível
                                  </Button>
                                </div>
                              ) : isFractional ? (
                                <>
                                  <div className="catalog-product-card__quantity">
                                    <span className="catalog-product-card__label">Quantidade</span>
                                    <div className="catalog-product-card__stepper" aria-label={`Controles de quantidade para ${product.name}`}>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        aria-label={`Diminuir quantidade de ${product.name}`}
                                        onClick={() => adjustFractionInput(product, -1)}
                                      >
                                        -
                                      </Button>
                                      <span>{buildMeasurementDisplayQuantity(fractionalPreviewQuantity, product.measurementUnit) || formatFractionOptionLabel(product.measurementUnit, fractionInputValue)}</span>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        aria-label={`Aumentar quantidade de ${product.name}`}
                                        onClick={() => adjustFractionInput(product, 1)}
                                      >
                                        +
                                      </Button>
                                    </div>
                                  </div>

                                  {quantityConfig.quickOptions?.length ? (
                                    <label className="catalog-product-card__preset">
                                      <span>Atalho</span>
                                      <select
                                        aria-label={`Atalhos de quantidade para ${product.name}`}
                                        value={
                                          showCustomQuantityInput
                                            ? 'custom'
                                            : String(fractionInputValue || defaultFractionInputValue(product.measurementUnit))
                                        }
                                        onChange={(event) => {
                                          if (event.target.value === 'custom') {
                                            setFractionInputMode(product.id, 'custom');
                                            setFractionInput(
                                              product.id,
                                              getFractionInputValue(product) || defaultFractionInputValue(product.measurementUnit),
                                            );
                                            return;
                                          }

                                          setFractionInputMode(product.id, 'preset');
                                          setFractionInput(product.id, event.target.value);
                                        }}
                                      >
                                        {quantityConfig.quickOptions.map((option) => (
                                          <option key={option} value={String(option)}>
                                            {formatFractionOptionLabel(product.measurementUnit, option)}
                                          </option>
                                        ))}
                                        <option value="custom">Outra quantidade</option>
                                      </select>
                                    </label>
                                  ) : null}

                                  {showCustomQuantityInput ? (
                                    <label className="catalog-product-card__custom-input">
                                      <span>{quantityConfig.customLabel}</span>
                                      <div className="catalog-product-card__custom-row">
                                        <input
                                          type="number"
                                          min={quantityConfig.min}
                                          step={quantityConfig.step}
                                          aria-label={quantityConfig.customLabel}
                                          value={fractionInputValue}
                                          onChange={(event) => {
                                            setFractionInputMode(product.id, 'custom');
                                            setFractionInput(product.id, event.target.value);
                                          }}
                                        />
                                        <small>{quantityConfig.suffix}</small>
                                      </div>
                                    </label>
                                  ) : null}

                                  <div className="catalog-product-card__summary">
                                    <strong>{`${buildMeasurementDisplayQuantity(fractionalPreviewQuantity, product.measurementUnit)} | ${formatCurrency(fractionalPreviewTotal || 0)}`}</strong>
                                    <Button type="button" onClick={() => addFractionalProductToCart(product)}>
                                      Adicionar
                                    </Button>
                                  </div>

                                  {cartQuantity > 0 ? (
                                    <small className="catalog-product-card__cart-note">
                                      No carrinho: {buildMeasurementDisplayQuantity(cartQuantity, product.measurementUnit)}
                                    </small>
                                  ) : null}
                                </>
                              ) : cartQuantity > 0 ? (
                                <>
                                  <div className="catalog-product-card__summary">
                                    <strong>{`${cartQuantity} ${cartQuantity === 1 ? 'unidade' : 'unidades'} no carrinho`}</strong>
                                  </div>
                                  <div className="catalog-product-card__stepper" aria-label={`Controles de quantidade para ${product.name}`}>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      aria-label={`Diminuir quantidade de ${product.name}`}
                                      onClick={() => updateCartQuantity(product, cartQuantity - 1)}
                                    >
                                      -
                                    </Button>
                                    <span>{cartQuantity}</span>
                                    <Button
                                      type="button"
                                      aria-label={`Aumentar quantidade de ${product.name}`}
                                      onClick={() => {
                                        updateCartQuantity(product, cartQuantity + 1);
                                        onTrackAction?.({
                                          eventType: 'link_click',
                                          targetType: 'cart_add',
                                          targetLabel: product.name,
                                          sectionType: 'catalog',
                                        });
                                      }}
                                    >
                                      +
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <div className="catalog-product-card__summary">
                                  <strong>Pronto para adicionar</strong>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      updateCartQuantity(product, cartQuantity + 1);
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
        ) : (
          <div className="catalog-search-empty">
            <strong>Nenhum produto encontrado</strong>
            <p>Tente buscar por outro nome, categoria ou descrição.</p>
          </div>
        )}
      </Card>
    </>
  );
}
