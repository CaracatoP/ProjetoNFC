import { useEffect, useId, useMemo, useState } from 'react';
import {
  BUSINESS_MODULE_KEY_VALUES,
  BUSINESS_SEGMENT_VALUES,
  DEFAULT_PRODUCT_MEASUREMENT_UNIT,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VALUES,
  PRODUCT_MEASUREMENT_UNIT_VALUES,
} from '@shared/constants/index.js';
import { buildBusinessSegmentState, getSegmentPreset } from '@shared/utils/segments.js';
import {
  buildLegacyDisplayQuantity,
  getMeasurementUnitLabel,
  normalizeProductMeasurement,
} from '@shared/utils/productMeasurement.js';
import { Button } from '@/components/common/Button.jsx';
import { AdminField, InlineImageUploadField, SectionEyebrow } from './TenantEditorPrimitives.jsx';

const MODULE_LABELS = {
  catalog: 'Catalogo',
  appointments: 'Agendamentos',
  cart: 'Carrinho',
  orders: 'Pedidos',
  loyalty: 'Fidelidade',
  whatsapp: 'WhatsApp',
  analytics: 'Analytics',
};

const ORDER_STATUS_ORDER = ['received', 'preparing', 'ready', 'delivered', 'cancelled'];
const ORDER_STATUS_LABELS = {
  received: 'Recebidos',
  preparing: 'Em preparo',
  ready: 'Prontos',
  delivered: 'Entregues',
  cancelled: 'Cancelados',
};
const ORDER_STATUS_BADGE_LABELS = {
  received: 'Recebido',
  preparing: 'Em preparo',
  ready: 'Pronto/Retirado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};
const ORDER_STATUS_TIMESTAMP_LABELS = {
  createdAt: 'Criado em',
  receivedAt: 'Recebido em',
  preparingAt: 'Em preparo em',
  readyAt: 'Pronto em',
  deliveredAt: 'Entregue em',
  cancelledAt: 'Cancelado em',
};
const PAYMENT_STATUS_FILTER_LABELS = {
  all: 'Todos',
  [PAYMENT_STATUS.PENDING]: PAYMENT_STATUS_LABELS[PAYMENT_STATUS.PENDING],
  [PAYMENT_STATUS.PAID]: PAYMENT_STATUS_LABELS[PAYMENT_STATUS.PAID],
  [PAYMENT_STATUS.MANUAL]: PAYMENT_STATUS_LABELS[PAYMENT_STATUS.MANUAL],
  [PAYMENT_STATUS.FAILED]: PAYMENT_STATUS_LABELS[PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.CANCELLED]: PAYMENT_STATUS_LABELS[PAYMENT_STATUS.CANCELLED],
};
const ORDER_SORT_OPTIONS = {
  arrival: 'arrival',
  recent: 'recent',
  oldest: 'oldest',
};

const APPOINTMENT_STATUS_ORDER = ['pending', 'confirmed', 'cancelled'];
const APPOINTMENT_STATUS_LABELS = {
  pending: 'Pendentes',
  confirmed: 'Confirmados',
  cancelled: 'Cancelados',
};

function initialProfessional() {
  return {
    name: '',
    role: '',
    avatar: '',
    active: true,
  };
}

function initialAppointmentService() {
  return {
    name: '',
    price: 0,
    durationMinutes: 30,
    description: '',
    active: true,
  };
}

function initialProduct() {
  return {
    name: '',
    description: '',
    price: 0,
    image: '',
    imagePublicId: '',
    category: '',
    measurementUnit: DEFAULT_PRODUCT_MEASUREMENT_UNIT,
    active: true,
  };
}

function formatCurrencyValue(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
    .format(Number(value || 0))
    .replace(/\u00a0/g, ' ');
}

function tabIsVisible(tabId, modules) {
  if (tabId === 'segment') {
    return true;
  }

  if (tabId === 'catalog') {
    return Boolean(modules.catalog);
  }

  if (tabId === 'orders') {
    return Boolean(modules.orders || modules.cart);
  }

  if (tabId === 'appointments' || tabId === 'professionals' || tabId === 'services') {
    return Boolean(modules.appointments);
  }

  return false;
}

function updateListItem(list, index, updater) {
  return list.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

function normalizeCategoryLabel(value) {
  return String(value || '').trim() || 'Outros';
}

function buildCategorySuggestions(products = []) {
  return Array.from(
    new Set(
      products
        .map((product) => String(product.category || '').trim())
        .filter(Boolean),
    ),
  ).sort((first, second) => first.localeCompare(second, 'pt-BR'));
}

function normalizeProductSearchTerm(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSearchTerm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function matchesProductSearch(product, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    product?.name,
    product?.category,
    product?.description,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .join(' ');

  return haystack.includes(searchTerm);
}

function filterAndGroupByStatus(items = [], filterValue, statusOrder, labels) {
  const visibleItems = filterValue === 'all' ? items : items.filter((item) => item.status === filterValue);

  return statusOrder
    .map((status) => ({
      status,
      label: labels[status] || status,
      items: visibleItems.filter((item) => item.status === status),
    }))
    .filter((group) => group.items.length);
}

function matchesOrderSearch(order, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    order?.customerName,
    order?.customerPhone,
    ...(order?.items || []).map((item) => item?.name),
  ]
    .map((value) => normalizeSearchTerm(value))
    .join(' ');

  return haystack.includes(searchTerm);
}

function getOrderSortTimestamp(order, sortMode) {
  if (sortMode === ORDER_SORT_OPTIONS.arrival) {
    return new Date(order?.receivedAt || order?.createdAt || 0).getTime();
  }

  return new Date(order?.createdAt || order?.receivedAt || 0).getTime();
}

function sortOrders(items = [], sortMode) {
  return [...items].sort((first, second) => {
    const firstTimestamp = getOrderSortTimestamp(first, sortMode);
    const secondTimestamp = getOrderSortTimestamp(second, sortMode);

    if (sortMode === ORDER_SORT_OPTIONS.oldest || sortMode === ORDER_SORT_OPTIONS.arrival) {
      return firstTimestamp - secondTimestamp;
    }

    return secondTimestamp - firstTimestamp;
  });
}

function filterAndGroupOrders(items = [], { filterValue = 'all', searchValue = '', sortMode = ORDER_SORT_OPTIONS.recent } = {}) {
  const normalizedSearchTerm = normalizeSearchTerm(searchValue);
  const visibleItems = items
    .filter((item) => (filterValue === 'all' ? true : item.status === filterValue))
    .filter((item) => matchesOrderSearch(item, normalizedSearchTerm));

  return ORDER_STATUS_ORDER.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status] || status,
    items: sortOrders(
      visibleItems.filter((item) => item.status === status),
      sortMode,
    ),
  })).filter((group) => group.items.length);
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(value) {
  if (!value) {
    return '';
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const minutesDiff = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

  if (minutesDiff < 60) {
    return `Ha ${minutesDiff} min`;
  }

  const hoursDiff = Math.round(minutesDiff / 60);

  if (hoursDiff < 24) {
    return `Ha ${hoursDiff} h`;
  }

  const daysDiff = Math.round(hoursDiff / 24);
  return `Ha ${daysDiff} dia(s)`;
}

function buildOrderTimeline(order) {
  return [
    ['createdAt', order?.createdAt],
    ['receivedAt', order?.receivedAt || order?.createdAt],
    ['preparingAt', order?.preparingAt],
    ['readyAt', order?.readyAt],
    ['deliveredAt', order?.deliveredAt],
    ['cancelledAt', order?.cancelledAt],
  ].filter(([, value]) => Boolean(value));
}

function getBusyMessage(busyKey) {
  if (!busyKey) {
    return '';
  }

  if (busyKey.includes('product')) {
    return 'Atualizando catalogo do tenant...';
  }

  if (busyKey.includes('professional')) {
    return 'Atualizando profissionais...';
  }

  if (busyKey.includes('appointment')) {
    return 'Atualizando agendamentos...';
  }

  if (busyKey.includes('order')) {
    return 'Atualizando pedidos...';
  }

  return 'Processando alteracao...';
}

export function TenantModuleManagementSection({
  draft,
  onDraftChange,
  moduleActions,
  busyKey = '',
  onUpload,
  mode = 'admin',
  permissions = {},
}) {
  const isClientMode = mode === 'client';
  const segmentState = useMemo(() => buildBusinessSegmentState(draft.business), [draft.business]);
  const modulesData = draft.modulesData || {};
  const categorySuggestionsId = useId();
  const [activeTab, setActiveTab] = useState('segment');
  const [newProfessional, setNewProfessional] = useState(initialProfessional);
  const [newAppointmentService, setNewAppointmentService] = useState(initialAppointmentService);
  const [newProduct, setNewProduct] = useState(initialProduct);
  const [isClientCreateProductOpen, setIsClientCreateProductOpen] = useState(mode !== 'client');
  const [editingProfessionals, setEditingProfessionals] = useState([]);
  const [editingAppointmentServices, setEditingAppointmentServices] = useState([]);
  const [editingProducts, setEditingProducts] = useState([]);
  const [productSearchValue, setProductSearchValue] = useState('');
  const [orderSearchValue, setOrderSearchValue] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all');
  const [orderSort, setOrderSort] = useState(ORDER_SORT_OPTIONS.recent);
  const [appointmentFilter, setAppointmentFilter] = useState('all');
  const [uploadingAssetKey, setUploadingAssetKey] = useState('');
  const [catalogProductsCollapsed, setCatalogProductsCollapsed] = useState(false);
  const [collapsedOrderGroups, setCollapsedOrderGroups] = useState(() =>
    Object.fromEntries(ORDER_STATUS_ORDER.map((status) => [status, status !== 'received'])),
  );
  const [pendingOrderArchiveId, setPendingOrderArchiveId] = useState('');
  const capabilityState = {
    canConfigureModules: mode === 'admin',
    canViewCatalog: permissions.canViewCatalog ?? true,
    canEditCatalog: permissions.canEditCatalog ?? true,
    canViewOrders: permissions.canViewOrders ?? true,
    canManageOrders: permissions.canManageOrders ?? true,
    canViewAppointments: permissions.canViewAppointments ?? true,
    canManageAppointments: permissions.canManageAppointments ?? true,
    canViewProfessionals: permissions.canViewProfessionals ?? true,
    canEditProfessionals: permissions.canEditProfessionals ?? true,
    canViewServices: permissions.canViewServices ?? true,
    canEditServices: permissions.canEditServices ?? true,
    canUploadMedia: permissions.canUploadMedia ?? true,
  };

  const visibleTabs = useMemo(
    () =>
      [
        { id: 'segment', label: 'Segmento e modulos', visible: capabilityState.canConfigureModules },
        { id: 'catalog', label: 'Catalogo', visible: capabilityState.canViewCatalog },
        { id: 'orders', label: 'Pedidos', visible: capabilityState.canViewOrders },
        { id: 'appointments', label: 'Agendamentos', visible: capabilityState.canViewAppointments },
        { id: 'professionals', label: 'Profissionais', visible: capabilityState.canViewProfessionals },
        { id: 'services', label: 'Servicos', visible: capabilityState.canViewServices },
      ].filter((tab) => tab.visible && tabIsVisible(tab.id, segmentState.modules)),
    [
      capabilityState.canConfigureModules,
      capabilityState.canViewAppointments,
      capabilityState.canViewCatalog,
      capabilityState.canViewOrders,
      capabilityState.canViewProfessionals,
      capabilityState.canViewServices,
      segmentState.modules,
    ],
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || 'segment');
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    setIsClientCreateProductOpen(mode !== 'client');
  }, [mode]);

  useEffect(() => {
    setEditingProfessionals(modulesData.professionals || []);
    setEditingAppointmentServices(modulesData.appointmentServices || []);
    setEditingProducts((modulesData.products || []).map((product) => normalizeProductMeasurement(product)));
  }, [modulesData.appointmentServices, modulesData.products, modulesData.professionals]);

  const categorySuggestions = useMemo(
    () => buildCategorySuggestions([...(editingProducts || []), newProduct]),
    [editingProducts, newProduct],
  );

  const orderGroups = useMemo(() => {
    const paymentFilteredOrders = (modulesData.orders || []).filter((order) =>
      orderPaymentFilter === 'all' ? true : (order?.payment?.status || PAYMENT_STATUS.MANUAL) === orderPaymentFilter,
    );

    return filterAndGroupOrders(paymentFilteredOrders, {
      filterValue: orderFilter,
      searchValue: orderSearchValue,
      sortMode: orderSort,
    });
  }, [modulesData.orders, orderFilter, orderPaymentFilter, orderSearchValue, orderSort]);

  const appointmentGroups = useMemo(
    () =>
      filterAndGroupByStatus(
        modulesData.appointmentRequests || [],
        appointmentFilter,
        APPOINTMENT_STATUS_ORDER,
        APPOINTMENT_STATUS_LABELS,
      ),
    [appointmentFilter, modulesData.appointmentRequests],
  );
  const filteredEditingProducts = useMemo(() => {
    const normalizedSearchTerm = normalizeProductSearchTerm(productSearchValue);

    return editingProducts
      .map((product, originalIndex) => ({ product, originalIndex }))
      .filter(({ product }) => matchesProductSearch(product, normalizedSearchTerm));
  }, [editingProducts, productSearchValue]);

  function updateBusinessSegment(nextSegment) {
    const nextSegmentState = buildBusinessSegmentState({ segment: nextSegment });
    onDraftChange({
      ...draft,
      business: {
        ...draft.business,
        segment: nextSegmentState.segment,
        modules: nextSegmentState.modules,
        segmentConfig: nextSegmentState.segmentConfig,
      },
    });
  }

  function toggleModule(key, checked) {
    const nextState = buildBusinessSegmentState({
      segment: segmentState.segment,
      modules: {
        ...segmentState.modules,
        [key]: checked,
      },
      segmentConfig: draft.business.segmentConfig,
    });

    onDraftChange({
      ...draft,
      business: {
        ...draft.business,
        segment: nextState.segment,
        modules: nextState.modules,
        segmentConfig: nextState.segmentConfig,
      },
    });
  }

  async function handleInlineUpload({ file, assetType, uploadKey, onComplete }) {
    if (!file || !onUpload) {
      return;
    }

    setUploadingAssetKey(uploadKey);

    try {
      const uploaded = await onUpload(file, {
        tenantSlug: draft.business.slug,
        assetType,
      });

      onComplete?.(uploaded);
    } finally {
      setUploadingAssetKey('');
    }
  }

  const activeModules = BUSINESS_MODULE_KEY_VALUES.filter((key) => segmentState.modules[key]);
  const preset = getSegmentPreset(segmentState.segment);
  const busyMessage = getBusyMessage(busyKey);
  const ordersBusy = (busyKey === 'update-order-status' || busyKey === 'update-order-payment-status') || !capabilityState.canManageOrders;
  const archiveOrderBusy = busyKey === 'delete-order' || !capabilityState.canManageOrders;
  const appointmentsBusy = busyKey === 'update-appointment-request-status' || !capabilityState.canManageAppointments;
  const catalogReadOnly = !capabilityState.canEditCatalog;
  const professionalsReadOnly = !capabilityState.canEditProfessionals;
  const servicesReadOnly = !capabilityState.canEditServices;
  const compactCatalogLayout = isClientMode;
  const productFormGridClassName = `admin-form-grid admin-product-form__grid${compactCatalogLayout ? ' admin-form-grid--compact admin-product-form__grid--compact' : ''}`;
  const productDescriptionRows = compactCatalogLayout ? 2 : 3;

  function resetNewProductDraft() {
    setNewProduct(initialProduct());
  }

  function closeClientCreateProduct() {
    resetNewProductDraft();
    setIsClientCreateProductOpen(false);
  }

  async function handleCreateProduct() {
    await moduleActions?.createProduct?.(newProduct);
    resetNewProductDraft();

    if (isClientMode) {
      setIsClientCreateProductOpen(false);
    }
  }

  function isOrderGroupCollapsed(status) {
    if (!isClientMode) {
      return false;
    }

    return collapsedOrderGroups[status] ?? status !== 'received';
  }

  function toggleOrderGroup(status) {
    setCollapsedOrderGroups((current) => ({
      ...current,
      [status]: !isOrderGroupCollapsed(status),
    }));
  }

  async function handleArchiveOrder(orderId) {
    await moduleActions?.deleteOrder?.(orderId);
    setPendingOrderArchiveId('');
  }

  function canMarkPaymentAsPaid(order) {
    const payment = order?.payment || {};

    if (!capabilityState.canManageOrders) {
      return false;
    }

    if (payment.provider !== 'manual') {
      return false;
    }

    return payment.status !== PAYMENT_STATUS.PAID;
  }

  return (
    <div className="admin-card-stack admin-card-stack--airy">
      <div className="admin-panel-card__header">
        <div>
          <SectionEyebrow>{mode === 'admin' ? 'Segmentacao' : 'Operacao do tenant'}</SectionEyebrow>
          <h2>{mode === 'admin' ? 'Segmento e modulos' : 'Modulos ativos do tenant'}</h2>
          <p>
            {mode === 'admin'
              ? 'Escolha um preset de negocio, veja os modulos sugeridos e ajuste manualmente o que precisa ficar ativo.'
              : 'Acompanhe os modulos ativos e gerencie somente as areas liberadas para o seu nivel de acesso.'}
          </p>
        </div>
      </div>

      <div className="admin-module-tabs">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'secondary'}
            className="admin-module-tabs__button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {busyMessage ? <p className="admin-muted-copy">{busyMessage}</p> : null}

      {activeTab === 'segment' ? (
        <div className="admin-card-stack">
          <div className="admin-form-grid">
            <AdminField label="Segmento da empresa">
              <select value={segmentState.segment} onChange={(event) => updateBusinessSegment(event.target.value)} disabled={!capabilityState.canConfigureModules}>
                {BUSINESS_SEGMENT_VALUES.map((segmentValue) => (
                  <option key={segmentValue} value={segmentValue}>
                    {getSegmentPreset(segmentValue).label}
                  </option>
                ))}
              </select>
            </AdminField>
            <div className="admin-inline-note admin-inline-note--preview">
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
              <span>Ao trocar o segmento, o preset sugerido e reaplicado. Depois voce ainda pode ligar ou desligar cada modulo manualmente.</span>
            </div>
          </div>

          <div className="admin-module-grid">
            {BUSINESS_MODULE_KEY_VALUES.map((key) => (
              <label key={key} className="admin-module-card">
                <input
                  type="checkbox"
                  checked={Boolean(segmentState.modules[key])}
                  disabled={!capabilityState.canConfigureModules}
                  onChange={(event) => toggleModule(key, event.target.checked)}
                />
                <div>
                  <strong>{MODULE_LABELS[key]}</strong>
                  <span>{segmentState.modules[key] ? 'Ativo para este tenant.' : 'Desativado para este tenant.'}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="admin-inline-note admin-inline-note--preview">
            <strong>Funcionalidades ativadas</strong>
            <div className="admin-module-badges">
              {activeModules.length ? (
                activeModules.map((key) => (
                  <span key={key} className="admin-section-chip admin-section-chip--accent">
                    {MODULE_LABELS[key]}
                  </span>
                ))
              ) : (
                <span className="admin-section-chip admin-section-chip--muted">Nenhum modulo ativo</span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'professionals' ? (
        <div className="admin-card-stack">
          {professionalsReadOnly ? <p className="admin-muted-copy">Seu nivel atual pode visualizar profissionais, mas nao editar este cadastro.</p> : null}
          <div className="admin-form-grid">
            <AdminField label="Nome">
              <input disabled={professionalsReadOnly} value={newProfessional.name} onChange={(event) => setNewProfessional((current) => ({ ...current, name: event.target.value }))} />
            </AdminField>
            <AdminField label="Funcao">
              <input disabled={professionalsReadOnly} value={newProfessional.role} onChange={(event) => setNewProfessional((current) => ({ ...current, role: event.target.value }))} />
            </AdminField>
          </div>
          <InlineImageUploadField
            label="Avatar do profissional"
            manualLabel="URL do avatar"
            value={newProfessional.avatar}
            alt={newProfessional.name || 'Avatar do profissional'}
            uploading={capabilityState.canUploadMedia && uploadingAssetKey === 'new-professional-avatar'}
            uploadingLabel="Enviando avatar..."
            disabled={professionalsReadOnly || !capabilityState.canUploadMedia}
            onChange={(value) => setNewProfessional((current) => ({ ...current, avatar: value }))}
            onUpload={(file) =>
              handleInlineUpload({
                file,
                assetType: 'professional',
                uploadKey: 'new-professional-avatar',
                onComplete: (uploaded) =>
                  setNewProfessional((current) => ({
                    ...current,
                    avatar: uploaded?.url || '',
                  })),
              })
            }
            onRemove={() => setNewProfessional((current) => ({ ...current, avatar: '' }))}
          />
          <Button
            disabled={professionalsReadOnly || !newProfessional.name.trim() || busyKey === 'create-professional'}
            onClick={async () => {
              await moduleActions?.createProfessional?.(newProfessional);
              setNewProfessional(initialProfessional());
            }}
          >
            {busyKey === 'create-professional' ? 'Salvando...' : 'Adicionar profissional'}
          </Button>

          {editingProfessionals.length ? (
            <div className="admin-repeater-list">
              {editingProfessionals.map((professional, index) => (
                <div key={professional.id || index} className="admin-repeater-card">
                  <div className="admin-form-grid">
                    <AdminField label="Nome">
                      <input
                        disabled={professionalsReadOnly}
                        value={professional.name || ''}
                        onChange={(event) =>
                          setEditingProfessionals((current) =>
                            updateListItem(current, index, (item) => ({ ...item, name: event.target.value })),
                          )
                        }
                      />
                    </AdminField>
                    <AdminField label="Funcao">
                      <input
                        disabled={professionalsReadOnly}
                        value={professional.role || ''}
                        onChange={(event) =>
                          setEditingProfessionals((current) =>
                            updateListItem(current, index, (item) => ({ ...item, role: event.target.value })),
                          )
                        }
                      />
                    </AdminField>
                  </div>
                  <InlineImageUploadField
                    label="Avatar do profissional"
                    manualLabel="URL do avatar"
                    value={professional.avatar || ''}
                    alt={professional.name || 'Avatar do profissional'}
                    uploading={capabilityState.canUploadMedia && uploadingAssetKey === `professional-${index}`}
                    uploadingLabel="Enviando avatar..."
                    disabled={professionalsReadOnly || !capabilityState.canUploadMedia}
                    onChange={(value) =>
                      setEditingProfessionals((current) =>
                        updateListItem(current, index, (item) => ({ ...item, avatar: value })),
                      )
                    }
                    onUpload={(file) =>
                      handleInlineUpload({
                        file,
                        assetType: 'professional',
                        uploadKey: `professional-${index}`,
                        onComplete: (uploaded) =>
                          setEditingProfessionals((current) =>
                            updateListItem(current, index, (item) => ({
                              ...item,
                              avatar: uploaded?.url || '',
                            })),
                          ),
                      })
                    }
                    onRemove={() =>
                      setEditingProfessionals((current) =>
                        updateListItem(current, index, (item) => ({ ...item, avatar: '' })),
                      )
                    }
                  />
                  <div className="admin-inline-actions">
                    <Button
                      variant="secondary"
                      disabled={professionalsReadOnly || !professional.name?.trim() || busyKey === 'update-professional'}
                      onClick={() => moduleActions?.updateProfessional?.(professional.id, professional)}
                    >
                      {busyKey === 'update-professional' ? 'Salvando...' : 'Salvar profissional'}
                    </Button>
                    <Button
                      variant="secondary"
                      className="button--danger-tone"
                      disabled={professionalsReadOnly || busyKey === 'delete-professional'}
                      onClick={() => moduleActions?.deleteProfessional?.(professional.id)}
                    >
                      {busyKey === 'delete-professional' ? 'Removendo...' : 'Remover'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-muted-copy">Nenhum profissional cadastrado</p>
          )}
        </div>
      ) : null}

      {activeTab === 'services' ? (
        <div className="admin-card-stack">
          {servicesReadOnly ? <p className="admin-muted-copy">Seu nivel atual pode visualizar servicos, mas nao editar este cadastro.</p> : null}
          <div className="admin-form-grid">
            <AdminField label="Servico">
              <input disabled={servicesReadOnly} value={newAppointmentService.name} onChange={(event) => setNewAppointmentService((current) => ({ ...current, name: event.target.value }))} />
            </AdminField>
            <AdminField label="Preco">
              <input disabled={servicesReadOnly} type="number" min="0" step="0.01" value={newAppointmentService.price} onChange={(event) => setNewAppointmentService((current) => ({ ...current, price: Number(event.target.value) }))} />
            </AdminField>
            <AdminField label="Duracao (min)">
              <input disabled={servicesReadOnly} type="number" min="5" step="5" value={newAppointmentService.durationMinutes} onChange={(event) => setNewAppointmentService((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} />
            </AdminField>
          </div>
          <AdminField label="Descricao">
            <textarea disabled={servicesReadOnly} rows="3" value={newAppointmentService.description} onChange={(event) => setNewAppointmentService((current) => ({ ...current, description: event.target.value }))} />
          </AdminField>
          <Button disabled={servicesReadOnly || !newAppointmentService.name.trim() || busyKey === 'create-appointment-service'} onClick={async () => {
            await moduleActions?.createAppointmentService?.(newAppointmentService);
            setNewAppointmentService(initialAppointmentService());
          }}>
            {busyKey === 'create-appointment-service' ? 'Salvando...' : 'Adicionar servico'}
          </Button>

          {editingAppointmentServices.length ? (
            <div className="admin-repeater-list">
              {editingAppointmentServices.map((service, index) => (
                <div key={service.id || index} className="admin-repeater-card">
                  <div className="admin-form-grid">
                    <AdminField label="Servico">
                      <input disabled={servicesReadOnly} value={service.name || ''} onChange={(event) => setEditingAppointmentServices((current) => updateListItem(current, index, (item) => ({ ...item, name: event.target.value })))} />
                    </AdminField>
                    <AdminField label="Preco">
                      <input disabled={servicesReadOnly} type="number" min="0" step="0.01" value={service.price ?? 0} onChange={(event) => setEditingAppointmentServices((current) => updateListItem(current, index, (item) => ({ ...item, price: Number(event.target.value) })))} />
                    </AdminField>
                    <AdminField label="Duracao (min)">
                      <input disabled={servicesReadOnly} type="number" min="5" step="5" value={service.durationMinutes ?? 30} onChange={(event) => setEditingAppointmentServices((current) => updateListItem(current, index, (item) => ({ ...item, durationMinutes: Number(event.target.value) })))} />
                    </AdminField>
                  </div>
                  <AdminField label="Descricao">
                    <textarea disabled={servicesReadOnly} rows="3" value={service.description || ''} onChange={(event) => setEditingAppointmentServices((current) => updateListItem(current, index, (item) => ({ ...item, description: event.target.value })))} />
                  </AdminField>
                  <div className="admin-inline-actions">
                    <Button variant="secondary" disabled={servicesReadOnly || !service.name?.trim() || busyKey === 'update-appointment-service'} onClick={() => moduleActions?.updateAppointmentService?.(service.id, service)}>
                      {busyKey === 'update-appointment-service' ? 'Salvando...' : 'Salvar servico'}
                    </Button>
                    <Button variant="secondary" className="button--danger-tone" disabled={servicesReadOnly || busyKey === 'delete-appointment-service'} onClick={() => moduleActions?.deleteAppointmentService?.(service.id)}>
                      {busyKey === 'delete-appointment-service' ? 'Removendo...' : 'Remover'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-muted-copy">Nenhum servico cadastrado</p>
          )}
        </div>
      ) : null}

      {activeTab === 'catalog' ? (
        <div className={`admin-card-stack admin-product-management${compactCatalogLayout ? ' admin-product-management--client' : ''}`}>
          {catalogReadOnly ? <p className="admin-muted-copy">Seu nivel atual pode visualizar o catalogo, mas nao editar produtos.</p> : null}
          <datalist id={categorySuggestionsId}>
            {categorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>

          <label className="admin-field admin-product-search-field">
            <span>Buscar produto</span>
            <input
              type="search"
              value={productSearchValue}
              onChange={(event) => setProductSearchValue(event.target.value)}
              placeholder="Buscar produto por nome, categoria ou descricao"
            />
          </label>

          {isClientMode ? (
            !catalogReadOnly ? (
              <section
                className={`admin-repeater-card admin-repeater-card--product admin-product-create-card${isClientCreateProductOpen ? ' admin-product-create-card--expanded' : ''}`}
              >
                <div className="admin-product-create-card__header">
                  <div className="admin-product-create-card__copy">
                    <strong>Adicionar produto</strong>
                    <span>Abra o formulario somente quando precisar cadastrar um novo item no catalogo.</span>
                  </div>
                  {!isClientCreateProductOpen ? (
                    <Button variant="secondary" onClick={() => setIsClientCreateProductOpen(true)}>
                      Adicionar produto
                    </Button>
                  ) : null}
                </div>

                {isClientCreateProductOpen ? (
                  <div className="admin-card-stack admin-product-create-card__body" data-testid="client-product-create-form">
                    <div className={productFormGridClassName}>
                      <AdminField label="Produto">
                        <input disabled={catalogReadOnly} value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} />
                      </AdminField>
                      <AdminField label="Preco">
                        <input disabled={catalogReadOnly} type="number" min="0" step="0.01" value={newProduct.price} onChange={(event) => setNewProduct((current) => ({ ...current, price: Number(event.target.value) }))} />
                      </AdminField>
                      <AdminField label="Categoria">
                        <input disabled={catalogReadOnly} list={categorySuggestionsId} value={newProduct.category} onChange={(event) => setNewProduct((current) => ({ ...current, category: event.target.value }))} />
                      </AdminField>
                      <AdminField label="Unidade de venda">
                        <select
                          disabled={catalogReadOnly}
                          value={newProduct.measurementUnit}
                          onChange={(event) => setNewProduct((current) => ({ ...current, measurementUnit: event.target.value }))}
                        >
                          {PRODUCT_MEASUREMENT_UNIT_VALUES.map((measurementUnit) => (
                            <option key={measurementUnit} value={measurementUnit}>
                              {getMeasurementUnitLabel(measurementUnit)}
                            </option>
                          ))}
                        </select>
                      </AdminField>
                    </div>
                    <p className="admin-muted-copy admin-product-form__hint">
                      O preco sera calculado conforme a unidade escolhida. Ex.: R$ 59,90/Kg permite pedido de 400g com calculo proporcional.
                    </p>
                    <div className="admin-product-form__support admin-product-form__support--compact">
                      <div className="admin-product-form__media">
                        <InlineImageUploadField
                          label="Imagem do produto"
                          value={newProduct.image}
                          alt={newProduct.name || 'Imagem do produto'}
                          uploading={capabilityState.canUploadMedia && uploadingAssetKey === 'new-product-image'}
                          uploadingLabel="Enviando imagem..."
                          disabled={catalogReadOnly || !capabilityState.canUploadMedia}
                          onChange={(value) => setNewProduct((current) => ({ ...current, image: value, imagePublicId: '' }))}
                          onUpload={(file) =>
                            handleInlineUpload({
                              file,
                              assetType: 'product',
                              uploadKey: 'new-product-image',
                              onComplete: (uploaded) =>
                                setNewProduct((current) => ({
                                  ...current,
                                  image: uploaded?.url || '',
                                  imagePublicId: uploaded?.publicId || '',
                                })),
                            })
                          }
                          onRemove={() => setNewProduct((current) => ({ ...current, image: '', imagePublicId: '' }))}
                        />
                      </div>
                      <div className="admin-product-form__description">
                        <AdminField label="Descricao">
                          <textarea disabled={catalogReadOnly} rows={productDescriptionRows} value={newProduct.description} onChange={(event) => setNewProduct((current) => ({ ...current, description: event.target.value }))} />
                        </AdminField>
                      </div>
                    </div>
                    <div className="admin-inline-actions admin-product-form__actions">
                      <Button variant="secondary" disabled={busyKey === 'create-product'} onClick={closeClientCreateProduct}>
                        Cancelar
                      </Button>
                      <Button disabled={!newProduct.name.trim() || busyKey === 'create-product'} onClick={handleCreateProduct}>
                        {busyKey === 'create-product' ? 'Salvando...' : 'Salvar produto'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null
          ) : (
            <>
              <div className={productFormGridClassName}>
                <AdminField label="Produto">
                  <input disabled={catalogReadOnly} value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} />
                </AdminField>
                <AdminField label="Categoria">
                  <input disabled={catalogReadOnly} list={categorySuggestionsId} value={newProduct.category} onChange={(event) => setNewProduct((current) => ({ ...current, category: event.target.value }))} />
                </AdminField>
                <AdminField label="Preco">
                  <input disabled={catalogReadOnly} type="number" min="0" step="0.01" value={newProduct.price} onChange={(event) => setNewProduct((current) => ({ ...current, price: Number(event.target.value) }))} />
                </AdminField>
                <AdminField label="Unidade de venda">
                  <select
                    disabled={catalogReadOnly}
                    value={newProduct.measurementUnit}
                    onChange={(event) => setNewProduct((current) => ({ ...current, measurementUnit: event.target.value }))}
                  >
                    {PRODUCT_MEASUREMENT_UNIT_VALUES.map((measurementUnit) => (
                      <option key={measurementUnit} value={measurementUnit}>
                        {getMeasurementUnitLabel(measurementUnit)}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </div>
              <p className="admin-muted-copy admin-product-form__hint">
                O preco sera calculado conforme a unidade escolhida. Ex.: R$ 59,90/Kg permite pedido de 400g com calculo proporcional.
              </p>
              <div className="admin-product-form__support">
                <div className="admin-product-form__media">
                  <InlineImageUploadField
                    label="Imagem do produto"
                    value={newProduct.image}
                    alt={newProduct.name || 'Imagem do produto'}
                    uploading={capabilityState.canUploadMedia && uploadingAssetKey === 'new-product-image'}
                    uploadingLabel="Enviando imagem..."
                    disabled={catalogReadOnly || !capabilityState.canUploadMedia}
                    onChange={(value) => setNewProduct((current) => ({ ...current, image: value, imagePublicId: '' }))}
                    onUpload={(file) =>
                      handleInlineUpload({
                        file,
                        assetType: 'product',
                        uploadKey: 'new-product-image',
                        onComplete: (uploaded) =>
                          setNewProduct((current) => ({
                            ...current,
                            image: uploaded?.url || '',
                            imagePublicId: uploaded?.publicId || '',
                          })),
                      })
                    }
                    onRemove={() => setNewProduct((current) => ({ ...current, image: '', imagePublicId: '' }))}
                  />
                </div>
                <div className="admin-product-form__description">
                  <AdminField label="Descricao">
                    <textarea disabled={catalogReadOnly} rows={productDescriptionRows} value={newProduct.description} onChange={(event) => setNewProduct((current) => ({ ...current, description: event.target.value }))} />
                  </AdminField>
                </div>
              </div>
              <Button disabled={catalogReadOnly || !newProduct.name.trim() || busyKey === 'create-product'} onClick={handleCreateProduct}>
                {busyKey === 'create-product' ? 'Salvando...' : 'Adicionar produto'}
              </Button>
            </>
          )}

          {editingProducts.length ? (
            <section className="admin-card-stack admin-product-existing-section">
              {isClientMode ? (
                <div className="admin-product-existing-section__header">
                  <div className="admin-product-existing-section__copy">
                    <strong>Produtos cadastrados</strong>
                    <span>{editingProducts.length} item(ns) no catalogo atual.</span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setCatalogProductsCollapsed((current) => !current)}
                    aria-label={catalogProductsCollapsed ? 'Expandir produtos cadastrados' : 'Minimizar produtos cadastrados'}
                  >
                    {catalogProductsCollapsed ? 'Expandir' : 'Minimizar'}
                  </Button>
                </div>
              ) : null}

              {!catalogProductsCollapsed ? (
              <div className="admin-repeater-list">
                {filteredEditingProducts.map(({ product, originalIndex }) => (
                <div
                  key={product.id || originalIndex}
                  className={`admin-repeater-card admin-repeater-card--product${compactCatalogLayout ? ' admin-repeater-card--product-compact' : ''}`}
                >
                  {compactCatalogLayout ? (
                    <div className="admin-product-card__header">
                      <div className="admin-product-card__copy">
                        <strong>{product.name || `Produto ${originalIndex + 1}`}</strong>
                        <span>
                          {normalizeCategoryLabel(product.category)} / {getMeasurementUnitLabel(product.measurementUnit || DEFAULT_PRODUCT_MEASUREMENT_UNIT)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className={productFormGridClassName}>
                    <AdminField label="Produto">
                      <input disabled={catalogReadOnly} value={product.name || ''} onChange={(event) => setEditingProducts((current) => updateListItem(current, originalIndex, (item) => ({ ...item, name: event.target.value })))} />
                    </AdminField>
                    <AdminField label="Preco">
                      <input disabled={catalogReadOnly} type="number" min="0" step="0.01" value={product.price ?? 0} onChange={(event) => setEditingProducts((current) => updateListItem(current, originalIndex, (item) => ({ ...item, price: Number(event.target.value) })))} />
                    </AdminField>
                    <AdminField label="Categoria">
                      <input disabled={catalogReadOnly} list={categorySuggestionsId} value={product.category || ''} onChange={(event) => setEditingProducts((current) => updateListItem(current, originalIndex, (item) => ({ ...item, category: event.target.value })))} />
                    </AdminField>
                    <AdminField label="Unidade de venda">
                      <select
                        disabled={catalogReadOnly}
                        value={product.measurementUnit || DEFAULT_PRODUCT_MEASUREMENT_UNIT}
                        onChange={(event) =>
                          setEditingProducts((current) =>
                            updateListItem(current, originalIndex, (item) => ({
                              ...item,
                              measurementUnit: event.target.value,
                            })),
                          )
                        }
                      >
                        {PRODUCT_MEASUREMENT_UNIT_VALUES.map((measurementUnit) => (
                          <option key={measurementUnit} value={measurementUnit}>
                            {getMeasurementUnitLabel(measurementUnit)}
                          </option>
                        ))}
                      </select>
                    </AdminField>
                  </div>
                  <div className={`admin-product-form__support${compactCatalogLayout ? ' admin-product-form__support--compact' : ''}`}>
                    <div className="admin-product-form__media">
                      <InlineImageUploadField
                        label="Imagem do produto"
                        value={product.image || ''}
                        alt={product.name || 'Imagem do produto'}
                        uploading={capabilityState.canUploadMedia && uploadingAssetKey === `product-${originalIndex}`}
                        uploadingLabel="Enviando imagem..."
                        disabled={catalogReadOnly || !capabilityState.canUploadMedia}
                        onChange={(value) =>
                          setEditingProducts((current) =>
                            updateListItem(current, originalIndex, (item) => ({
                              ...item,
                              image: value,
                              imagePublicId: value ? item.imagePublicId || '' : '',
                            })),
                          )
                        }
                        onUpload={(file) =>
                          handleInlineUpload({
                            file,
                            assetType: 'product',
                            uploadKey: `product-${originalIndex}`,
                            onComplete: (uploaded) =>
                              setEditingProducts((current) =>
                                updateListItem(current, originalIndex, (item) => ({
                                  ...item,
                                  image: uploaded?.url || '',
                                  imagePublicId: uploaded?.publicId || '',
                                })),
                              ),
                          })
                        }
                        onRemove={() =>
                          setEditingProducts((current) =>
                            updateListItem(current, originalIndex, (item) => ({
                              ...item,
                              image: '',
                              imagePublicId: '',
                            })),
                          )
                        }
                      />
                    </div>
                    <div className="admin-product-form__description">
                      <AdminField label="Descricao">
                        <textarea disabled={catalogReadOnly} rows={productDescriptionRows} value={product.description || ''} onChange={(event) => setEditingProducts((current) => updateListItem(current, originalIndex, (item) => ({ ...item, description: event.target.value })))} />
                      </AdminField>
                    </div>
                  </div>
                  <div className="admin-inline-actions admin-product-form__actions">
                    <Button variant="secondary" disabled={catalogReadOnly || !product.name?.trim() || busyKey === 'update-product'} onClick={() => moduleActions?.updateProduct?.(product.id, product)}>
                      {busyKey === 'update-product' ? 'Salvando...' : 'Salvar produto'}
                    </Button>
                    <Button variant="secondary" className="button--danger-tone" disabled={catalogReadOnly || busyKey === 'delete-product'} onClick={() => moduleActions?.deleteProduct?.(product.id)}>
                      {busyKey === 'delete-product' ? 'Removendo...' : 'Remover'}
                    </Button>
                  </div>
                </div>
                ))}
              </div>
              ) : null}
            </section>
          ) : null}

          {editingProducts.length && !filteredEditingProducts.length ? (
            <p className="admin-muted-copy">Nenhum produto encontrado com essa busca.</p>
          ) : (
            !editingProducts.length ? <p className="admin-muted-copy">Nenhum produto cadastrado</p> : null
          )}
        </div>
      ) : null}

      {activeTab === 'appointments' ? (
        <div className="admin-card-stack">
          <div className="admin-form-grid">
            <AdminField label="Filtrar agendamentos por status">
              <select value={appointmentFilter} onChange={(event) => setAppointmentFilter(event.target.value)} disabled={appointmentsBusy}>
                <option value="all">Todos</option>
                {APPOINTMENT_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {APPOINTMENT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>

          {appointmentGroups.length ? (
            appointmentGroups.map((group) => (
              <section key={group.status} className="admin-module-status-group">
                <div className="admin-module-status-group__header">
                  <strong>{group.label}</strong>
                  <span>{group.items.length} item(ns)</span>
                </div>
                <div className="admin-repeater-list">
                  {group.items.map((request) => (
                    <div key={request.id} className="admin-repeater-card">
                      <strong>{request.customerName}</strong>
                      <span>{request.customerPhone}</span>
                      <span>{request.serviceName || 'Servico nao informado'} / {request.professionalName || 'Profissional nao informado'}</span>
                      <span>{request.requestedDate} as {request.requestedTime}</span>
                      {request.notes ? <p>{request.notes}</p> : null}
                      <AdminField label="Status do agendamento">
                        <select
                          value={request.status || 'pending'}
                          disabled={appointmentsBusy}
                          onChange={(event) => moduleActions?.updateAppointmentRequestStatus?.(request.id, event.target.value)}
                        >
                          {APPOINTMENT_STATUS_ORDER.map((status) => (
                            <option key={status} value={status}>
                              {APPOINTMENT_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </AdminField>
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p className="admin-muted-copy">Nenhuma solicitação de agendamento</p>
          )}
        </div>
      ) : null}

      {activeTab === 'orders' ? (
        <div className="admin-card-stack">
          <div className="admin-form-grid">
            <AdminField label="Buscar pedidos">
              <input
                value={orderSearchValue}
                onChange={(event) => setOrderSearchValue(event.target.value)}
                placeholder="Buscar por cliente, telefone ou item"
              />
            </AdminField>
            <AdminField label="Filtrar pedidos por status">
              <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} disabled={ordersBusy}>
                <option value="all">Todos</option>
                {ORDER_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {ORDER_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Filtrar pagamento">
              <select value={orderPaymentFilter} onChange={(event) => setOrderPaymentFilter(event.target.value)} disabled={ordersBusy}>
                {['all', ...PAYMENT_STATUS_VALUES].map((status) => (
                  <option key={status} value={status}>
                    {PAYMENT_STATUS_FILTER_LABELS[status] || status}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Ordenar pedidos">
              <select value={orderSort} onChange={(event) => setOrderSort(event.target.value)} disabled={ordersBusy}>
                <option value={ORDER_SORT_OPTIONS.arrival}>Ordem de chegada</option>
                <option value={ORDER_SORT_OPTIONS.recent}>Mais recente primeiro</option>
                <option value={ORDER_SORT_OPTIONS.oldest}>Mais antigo primeiro</option>
              </select>
            </AdminField>
          </div>

          {orderGroups.length ? (
            orderGroups.map((group) => (
              <section key={group.status} className="admin-module-status-group">
                <div className="admin-module-status-group__header">
                  <div className="admin-module-status-group__copy">
                    <strong>{group.label}</strong>
                    <span>{group.items.length} item(ns)</span>
                  </div>
                  {isClientMode ? (
                    <Button
                      variant="secondary"
                      onClick={() => toggleOrderGroup(group.status)}
                      aria-label={isOrderGroupCollapsed(group.status) ? `Expandir grupo ${group.label}` : `Minimizar grupo ${group.label}`}
                    >
                      {isOrderGroupCollapsed(group.status) ? 'Expandir' : 'Minimizar'}
                    </Button>
                  ) : null}
                </div>
                {!isOrderGroupCollapsed(group.status) ? (
                <div className="admin-repeater-list">
                  {group.items.map((order) => (
                    <div key={order.id} className="admin-repeater-card admin-order-card" data-testid={`order-card-${group.status}`}>
                      <div className="admin-order-card__header">
                        <div className="admin-order-card__identity">
                          <strong>{order.customerName}</strong>
                          <span>{order.customerPhone} - {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                        </div>
                        <div className={`admin-order-status-badge admin-order-status-badge--${order.status || 'received'}`}>
                          <i aria-hidden="true" />
                          <span>{ORDER_STATUS_BADGE_LABELS[order.status] || order.status || 'Recebido'}</span>
                        </div>
                      </div>
                      <div className="admin-order-card__meta">
                        <strong>{formatCurrencyValue(order.total)}</strong>
                        {order.createdAt ? (
                          <span className="admin-order-card__elapsed">{formatRelativeTime(order.createdAt)}</span>
                        ) : null}
                      </div>
                      {order.payment ? (
                        <div className="admin-order-payment">
                          <div className="admin-order-payment__meta">
                            <span className="admin-order-payment__method">
                              {PAYMENT_METHOD_LABELS[order.payment.method] || 'Pagamento manual'}
                            </span>
                            <div className={`admin-order-payment-badge admin-order-payment-badge--${order.payment.status || PAYMENT_STATUS.MANUAL}`}>
                              <i aria-hidden="true" />
                              <span>{PAYMENT_STATUS_LABELS[order.payment.status] || PAYMENT_STATUS_LABELS[PAYMENT_STATUS.MANUAL]}</span>
                            </div>
                          </div>
                          {canMarkPaymentAsPaid(order) ? (
                            <Button
                              variant="secondary"
                              disabled={ordersBusy}
                              onClick={() => moduleActions?.updateOrderPaymentStatus?.(order.id, PAYMENT_STATUS.PAID)}
                            >
                              Marcar pagamento como pago
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="admin-order-card__timeline">
                        {buildOrderTimeline(order).map(([field, value]) => (
                          <span key={`${order.id}-${field}`}>
                            <strong>{ORDER_STATUS_TIMESTAMP_LABELS[field]}:</strong> {formatDateTime(value)}
                          </span>
                        ))}
                      </div>
                      <ul className="admin-module-item-list">
                        {(order.items || []).map((item, index) => (
                          <li key={`${order.id}-item-${index}`}>
                            {item.name} - {item.displayQuantity || buildLegacyDisplayQuantity(item.quantity, item.measurementUnit)} x {formatCurrencyValue(item.unitPrice)}/{getMeasurementUnitLabel(item.measurementUnit)} = {formatCurrencyValue(item.itemTotal)}
                          </li>
                        ))}
                      </ul>
                      {order.notes ? <p>{order.notes}</p> : null}
                      <AdminField label="Status do pedido">
                        <select
                          value={order.status || 'received'}
                          disabled={ordersBusy}
                          onChange={(event) => moduleActions?.updateOrderStatus?.(order.id, event.target.value)}
                        >
                          {ORDER_STATUS_ORDER.map((status) => (
                            <option key={status} value={status}>
                              {ORDER_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </AdminField>
                      {isClientMode && capabilityState.canManageOrders ? (
                        <div className="admin-card-stack admin-order-archive">
                          {pendingOrderArchiveId === order.id ? (
                            <div className="admin-order-archive__confirm">
                              <p>Deseja excluir mesmo este pedido?</p>
                              <div className="admin-inline-actions">
                                <Button
                                  variant="secondary"
                                  className="button--danger-tone"
                                  disabled={archiveOrderBusy}
                                  onClick={() => handleArchiveOrder(order.id)}
                                  aria-label={`Confirmar exclusao do pedido ${order.customerName}`}
                                >
                                  {busyKey === 'delete-order' ? 'Arquivando...' : 'Confirmar exclusao'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  disabled={archiveOrderBusy}
                                  onClick={() => setPendingOrderArchiveId('')}
                                  aria-label={`Cancelar exclusao do pedido ${order.customerName}`}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="admin-inline-actions">
                              <Button
                                variant="secondary"
                                className="button--danger-tone"
                                disabled={archiveOrderBusy}
                                onClick={() => setPendingOrderArchiveId(order.id)}
                                aria-label={`Excluir pedido ${order.customerName}`}
                              >
                                Excluir pedido
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                ) : null}
              </section>
            ))
          ) : (
            <p className="admin-muted-copy">
              {orderSearchValue ? 'Nenhum pedido encontrado com essa busca.' : 'Nenhum pedido recebido'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
