import { useEffect, useId, useMemo, useState } from 'react';
import { BUSINESS_MODULE_KEY_VALUES, BUSINESS_SEGMENT_VALUES } from '@shared/constants/index.js';
import { buildBusinessSegmentState, getSegmentPreset } from '@shared/utils/segments.js';
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
}) {
  const segmentState = useMemo(() => buildBusinessSegmentState(draft.business), [draft.business]);
  const modulesData = draft.modulesData || {};
  const categorySuggestionsId = useId();
  const [activeTab, setActiveTab] = useState('segment');
  const [newProfessional, setNewProfessional] = useState(initialProfessional);
  const [newAppointmentService, setNewAppointmentService] = useState(initialAppointmentService);
  const [newProduct, setNewProduct] = useState(initialProduct);
  const [editingProfessionals, setEditingProfessionals] = useState([]);
  const [editingAppointmentServices, setEditingAppointmentServices] = useState([]);
  const [editingProducts, setEditingProducts] = useState([]);
  const [orderFilter, setOrderFilter] = useState('all');
  const [appointmentFilter, setAppointmentFilter] = useState('all');
  const [uploadingAssetKey, setUploadingAssetKey] = useState('');

  const visibleTabs = useMemo(
    () =>
      [
        { id: 'segment', label: 'Segmento e modulos' },
        { id: 'catalog', label: 'Catalogo' },
        { id: 'orders', label: 'Pedidos' },
        { id: 'appointments', label: 'Agendamentos' },
        { id: 'professionals', label: 'Profissionais' },
        { id: 'services', label: 'Servicos' },
      ].filter((tab) => tabIsVisible(tab.id, segmentState.modules)),
    [segmentState.modules],
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || 'segment');
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    setEditingProfessionals(modulesData.professionals || []);
    setEditingAppointmentServices(modulesData.appointmentServices || []);
    setEditingProducts(modulesData.products || []);
  }, [modulesData.appointmentServices, modulesData.products, modulesData.professionals]);

  const categorySuggestions = useMemo(
    () => buildCategorySuggestions([...(editingProducts || []), newProduct]),
    [editingProducts, newProduct],
  );

  const orderGroups = useMemo(
    () => filterAndGroupByStatus(modulesData.orders || [], orderFilter, ORDER_STATUS_ORDER, ORDER_STATUS_LABELS),
    [modulesData.orders, orderFilter],
  );

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
  const ordersBusy = busyKey === 'update-order-status';
  const appointmentsBusy = busyKey === 'update-appointment-request-status';

  return (
    <div className="admin-card-stack admin-card-stack--airy">
      <div className="admin-panel-card__header">
        <div>
          <SectionEyebrow>Segmentacao</SectionEyebrow>
          <h2>Segmento e modulos</h2>
          <p>Escolha um preset de negocio, veja os modulos sugeridos e ajuste manualmente o que precisa ficar ativo.</p>
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
              <select value={segmentState.segment} onChange={(event) => updateBusinessSegment(event.target.value)}>
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
          <div className="admin-form-grid">
            <AdminField label="Nome">
              <input value={newProfessional.name} onChange={(event) => setNewProfessional((current) => ({ ...current, name: event.target.value }))} />
            </AdminField>
            <AdminField label="Funcao">
              <input value={newProfessional.role} onChange={(event) => setNewProfessional((current) => ({ ...current, role: event.target.value }))} />
            </AdminField>
          </div>
          <InlineImageUploadField
            label="Avatar do profissional"
            manualLabel="URL do avatar"
            value={newProfessional.avatar}
            alt={newProfessional.name || 'Avatar do profissional'}
            uploading={uploadingAssetKey === 'new-professional-avatar'}
            uploadingLabel="Enviando avatar..."
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
            disabled={!newProfessional.name.trim() || busyKey === 'create-professional'}
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
                    uploading={uploadingAssetKey === `professional-${index}`}
                    uploadingLabel="Enviando avatar..."
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
                      disabled={!professional.name?.trim() || busyKey === 'update-professional'}
                      onClick={() => moduleActions?.updateProfessional?.(professional.id, professional)}
                    >
                      {busyKey === 'update-professional' ? 'Salvando...' : 'Salvar profissional'}
                    </Button>
                    <Button
                      variant="secondary"
                      className="button--danger-tone"
                      disabled={busyKey === 'delete-professional'}
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
          <div className="admin-form-grid">
            <AdminField label="Servico">
              <input value={newAppointmentService.name} onChange={(event) => setNewAppointmentService((current) => ({ ...current, name: event.target.value }))} />
            </AdminField>
            <AdminField label="Preco">
              <input type="number" min="0" step="0.01" value={newAppointmentService.price} onChange={(event) => setNewAppointmentService((current) => ({ ...current, price: Number(event.target.value) }))} />
            </AdminField>
            <AdminField label="Duracao (min)">
              <input type="number" min="5" step="5" value={newAppointmentService.durationMinutes} onChange={(event) => setNewAppointmentService((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} />
            </AdminField>
          </div>
          <AdminField label="Descricao">
            <textarea rows="3" value={newAppointmentService.description} onChange={(event) => setNewAppointmentService((current) => ({ ...current, description: event.target.value }))} />
          </AdminField>
          <Button disabled={!newAppointmentService.name.trim() || busyKey === 'create-appointment-service'} onClick={async () => {
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
                      <input value={service.name || ''} onChange={(event) => setEditingAppointmentServices((current) => updateListItem(current, index, (item) => ({ ...item, name: event.target.value })))} />
                    </AdminField>
                    <AdminField label="Preco">
                      <input type="number" min="0" step="0.01" value={service.price ?? 0} onChange={(event) => setEditingAppointmentServices((current) => updateListItem(current, index, (item) => ({ ...item, price: Number(event.target.value) })))} />
                    </AdminField>
                    <AdminField label="Duracao (min)">
                      <input type="number" min="5" step="5" value={service.durationMinutes ?? 30} onChange={(event) => setEditingAppointmentServices((current) => updateListItem(current, index, (item) => ({ ...item, durationMinutes: Number(event.target.value) })))} />
                    </AdminField>
                  </div>
                  <AdminField label="Descricao">
                    <textarea rows="3" value={service.description || ''} onChange={(event) => setEditingAppointmentServices((current) => updateListItem(current, index, (item) => ({ ...item, description: event.target.value })))} />
                  </AdminField>
                  <div className="admin-inline-actions">
                    <Button variant="secondary" disabled={!service.name?.trim() || busyKey === 'update-appointment-service'} onClick={() => moduleActions?.updateAppointmentService?.(service.id, service)}>
                      {busyKey === 'update-appointment-service' ? 'Salvando...' : 'Salvar servico'}
                    </Button>
                    <Button variant="secondary" className="button--danger-tone" disabled={busyKey === 'delete-appointment-service'} onClick={() => moduleActions?.deleteAppointmentService?.(service.id)}>
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
        <div className="admin-card-stack">
          <datalist id={categorySuggestionsId}>
            {categorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>

          <div className="admin-form-grid">
            <AdminField label="Produto">
              <input value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} />
            </AdminField>
            <AdminField label="Categoria">
              <input list={categorySuggestionsId} value={newProduct.category} onChange={(event) => setNewProduct((current) => ({ ...current, category: event.target.value }))} />
            </AdminField>
            <AdminField label="Preco">
              <input type="number" min="0" step="0.01" value={newProduct.price} onChange={(event) => setNewProduct((current) => ({ ...current, price: Number(event.target.value) }))} />
            </AdminField>
          </div>
          <InlineImageUploadField
            label="Imagem do produto"
            value={newProduct.image}
            alt={newProduct.name || 'Imagem do produto'}
            uploading={uploadingAssetKey === 'new-product-image'}
            uploadingLabel="Enviando imagem..."
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
          <AdminField label="Descricao">
            <textarea rows="3" value={newProduct.description} onChange={(event) => setNewProduct((current) => ({ ...current, description: event.target.value }))} />
          </AdminField>
          <Button disabled={!newProduct.name.trim() || busyKey === 'create-product'} onClick={async () => {
            await moduleActions?.createProduct?.(newProduct);
            setNewProduct(initialProduct());
          }}>
            {busyKey === 'create-product' ? 'Salvando...' : 'Adicionar produto'}
          </Button>

          {editingProducts.length ? (
            <div className="admin-repeater-list">
              {editingProducts.map((product, index) => (
                <div key={product.id || index} className="admin-repeater-card">
                  <div className="admin-form-grid">
                    <AdminField label="Produto">
                      <input value={product.name || ''} onChange={(event) => setEditingProducts((current) => updateListItem(current, index, (item) => ({ ...item, name: event.target.value })))} />
                    </AdminField>
                    <AdminField label="Categoria">
                      <input list={categorySuggestionsId} value={product.category || ''} onChange={(event) => setEditingProducts((current) => updateListItem(current, index, (item) => ({ ...item, category: event.target.value })))} />
                    </AdminField>
                    <AdminField label="Preco">
                      <input type="number" min="0" step="0.01" value={product.price ?? 0} onChange={(event) => setEditingProducts((current) => updateListItem(current, index, (item) => ({ ...item, price: Number(event.target.value) })))} />
                    </AdminField>
                  </div>
                  <InlineImageUploadField
                    label="Imagem do produto"
                    value={product.image || ''}
                    alt={product.name || 'Imagem do produto'}
                    uploading={uploadingAssetKey === `product-${index}`}
                    uploadingLabel="Enviando imagem..."
                    onChange={(value) =>
                      setEditingProducts((current) =>
                        updateListItem(current, index, (item) => ({
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
                        uploadKey: `product-${index}`,
                        onComplete: (uploaded) =>
                          setEditingProducts((current) =>
                            updateListItem(current, index, (item) => ({
                              ...item,
                              image: uploaded?.url || '',
                              imagePublicId: uploaded?.publicId || '',
                            })),
                          ),
                      })
                    }
                    onRemove={() =>
                      setEditingProducts((current) =>
                        updateListItem(current, index, (item) => ({
                          ...item,
                          image: '',
                          imagePublicId: '',
                        })),
                      )
                    }
                  />
                  <AdminField label="Descricao">
                    <textarea rows="3" value={product.description || ''} onChange={(event) => setEditingProducts((current) => updateListItem(current, index, (item) => ({ ...item, description: event.target.value })))} />
                  </AdminField>
                  <div className="admin-inline-actions">
                    <Button variant="secondary" disabled={!product.name?.trim() || busyKey === 'update-product'} onClick={() => moduleActions?.updateProduct?.(product.id, product)}>
                      {busyKey === 'update-product' ? 'Salvando...' : 'Salvar produto'}
                    </Button>
                    <Button variant="secondary" className="button--danger-tone" disabled={busyKey === 'delete-product'} onClick={() => moduleActions?.deleteProduct?.(product.id)}>
                      {busyKey === 'delete-product' ? 'Removendo...' : 'Remover'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-muted-copy">Nenhum produto cadastrado</p>
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
          </div>

          {orderGroups.length ? (
            orderGroups.map((group) => (
              <section key={group.status} className="admin-module-status-group">
                <div className="admin-module-status-group__header">
                  <strong>{group.label}</strong>
                  <span>{group.items.length} item(ns)</span>
                </div>
                <div className="admin-repeater-list">
                  {group.items.map((order) => (
                    <div key={order.id} className="admin-repeater-card">
                      <strong>{order.customerName}</strong>
                      <span>{order.customerPhone} - {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                      <strong>{formatCurrencyValue(order.total)}</strong>
                      <ul className="admin-module-item-list">
                        {(order.items || []).map((item, index) => (
                          <li key={`${order.id}-item-${index}`}>
                            {item.quantity}x {item.name} ({formatCurrencyValue(item.unitPrice)})
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
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p className="admin-muted-copy">Nenhum pedido recebido</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
