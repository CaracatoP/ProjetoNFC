import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ANALYTICS_SCOPE_LABELS,
  BILLING_ACCESS_LABELS,
  ROLE_LEVEL_LABELS,
} from '@shared/constants/access.js';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { AppShell } from '@/components/layout/AppShell.jsx';
import {
  AdminField,
  InlineImageUploadField,
  SectionEyebrow,
} from '@/components/business/editor/TenantEditorPrimitives.jsx';
import { TenantModuleManagementSection } from '@/components/business/editor/TenantModuleManagementSection.jsx';
import {
  buildValidationErrors,
  cloneDeep,
  getInputState,
  newHourItem,
} from '@/components/business/editor/tenantEditorUtils.js';
import { useAuth } from '@/context/AuthContext.jsx';
import {
  createClientPanelAppointmentService,
  createClientPanelProduct,
  createClientPanelProfessional,
  deleteClientPanelAppointmentService,
  deleteClientPanelProduct,
  deleteClientPanelProfessional,
  fetchClientPanelAnalytics,
  fetchClientPanelBusiness,
  updateClientPanelAppointmentRequestStatus,
  updateClientPanelAppointmentService,
  updateClientPanelBusinessBasics,
  updateClientPanelOrderStatus,
  updateClientPanelProduct,
  updateClientPanelProfessional,
  uploadClientPanelImage,
} from '@/services/clientPanelService.js';

const BASIC_ERROR_PREFIXES = [
  'business.name',
  'business.legalName',
  'business.description',
  'business.logoUrl',
  'business.logoPublicId',
  'business.bannerUrl',
  'business.bannerPublicId',
  'business.badge',
  'business.rating',
  'business.address',
  'business.hours',
  'business.contact',
  'business.seo',
];

function extractBasicValidationErrors(validationErrors = {}) {
  return Object.fromEntries(
    Object.entries(validationErrors).filter(([path]) => BASIC_ERROR_PREFIXES.some((prefix) => path.startsWith(prefix))),
  );
}

function buildBasicBusinessPayload(draft) {
  return {
    business: {
      name: draft.business?.name || '',
      legalName: draft.business?.legalName || '',
      description: draft.business?.description || '',
      logoUrl: draft.business?.logoUrl || '',
      logoPublicId: draft.business?.logoPublicId || '',
      bannerUrl: draft.business?.bannerUrl || '',
      bannerPublicId: draft.business?.bannerPublicId || '',
      badge: draft.business?.badge || '',
      rating: draft.business?.rating || '',
      address: draft.business?.address || {},
      hours: draft.business?.hours || [],
      contact: draft.business?.contact || {},
      seo: draft.business?.seo || {},
    },
  };
}

function getErrorMessage(error) {
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details
      .filter((detail) => detail?.message)
      .map((detail) => (detail.path ? `${detail.path}: ${detail.message}` : detail.message))
      .join(' | ');
  }

  return error?.message || 'Nao foi possivel concluir esta operacao.';
}

function AnalyticsMetric({ label, value, description }) {
  return (
    <div className="admin-mini-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

function BillingBanner({ billingStatus }) {
  if (billingStatus !== 'overdue') {
    return null;
  }

  return (
    <p className="admin-status-banner admin-status-banner--warning">
      Pagamento vencido: seu painel segue visivel, mas uploads e alteracoes criticas ficam bloqueados ate a regularizacao.
    </p>
  );
}

function BasicSettingsCard({
  draft,
  validationErrors,
  saving,
  canEdit,
  canUploadMedia,
  onChange,
  onUpload,
  onSave,
}) {
  const [uploadingField, setUploadingField] = useState('');

  const handleInlineUpload = async (file, assetType, patch) => {
    if (!file || !onUpload) {
      return;
    }

    setUploadingField(assetType);
    try {
      const uploaded = await onUpload(file, { tenantSlug: draft.business?.slug, assetType });
      patch(uploaded);
    } finally {
      setUploadingField('');
    }
  };

  return (
    <Card className="admin-panel-card">
      <div className="admin-panel-card__header">
        <div>
          <SectionEyebrow>Configuracoes basicas</SectionEyebrow>
          <h2>Dados publicos do negocio</h2>
          <p>Atualize nome, descricao, contato, horarios e imagens basicas sem tocar em configuracoes sensiveis do tenant.</p>
        </div>
      </div>

      {!canEdit ? <p className="admin-muted-copy">Seu nivel atual pode visualizar esses dados, mas nao editar esta area.</p> : null}

      <div className="admin-card-stack admin-card-stack--airy">
        <div className="admin-form-grid">
          <AdminField label="Nome do negocio" error={validationErrors['business.name']}>
            <input
              disabled={!canEdit}
              value={draft.business?.name || ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    name: event.target.value,
                  },
                }))
              }
              {...getInputState(validationErrors['business.name'])}
            />
          </AdminField>
          <AdminField label="Nome legal">
            <input
              disabled={!canEdit}
              value={draft.business?.legalName || ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    legalName: event.target.value,
                  },
                }))
              }
            />
          </AdminField>
          <AdminField label="Badge">
            <input
              disabled={!canEdit}
              value={draft.business?.badge || ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    badge: event.target.value,
                  },
                }))
              }
            />
          </AdminField>
        </div>

        <AdminField label="Descricao">
          <textarea
            disabled={!canEdit}
            rows="4"
            value={draft.business?.description || ''}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                business: {
                  ...current.business,
                  description: event.target.value,
                },
              }))
            }
          />
        </AdminField>

        <div className="admin-form-grid">
          <InlineImageUploadField
            label="Logo do negocio"
            manualLabel="URL da logo"
            value={draft.business?.logoUrl || ''}
            alt={draft.business?.name || 'Logo do negocio'}
            disabled={!canEdit || !canUploadMedia}
            uploading={uploadingField === 'logo'}
            onChange={(value) =>
              onChange((current) => ({
                ...current,
                business: {
                  ...current.business,
                  logoUrl: value,
                  logoPublicId: value ? current.business?.logoPublicId || '' : '',
                },
              }))
            }
            onUpload={(file) =>
              handleInlineUpload(file, 'logo', (uploaded) =>
                onChange((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    logoUrl: uploaded?.url || '',
                    logoPublicId: uploaded?.publicId || '',
                  },
                })),
              )
            }
            onRemove={() =>
              onChange((current) => ({
                ...current,
                business: {
                  ...current.business,
                  logoUrl: '',
                  logoPublicId: '',
                },
              }))
            }
          />

          <InlineImageUploadField
            label="Banner do negocio"
            manualLabel="URL do banner"
            value={draft.business?.bannerUrl || ''}
            alt={draft.business?.name || 'Banner do negocio'}
            disabled={!canEdit || !canUploadMedia}
            uploading={uploadingField === 'banner'}
            onChange={(value) =>
              onChange((current) => ({
                ...current,
                business: {
                  ...current.business,
                  bannerUrl: value,
                  bannerPublicId: value ? current.business?.bannerPublicId || '' : '',
                },
              }))
            }
            onUpload={(file) =>
              handleInlineUpload(file, 'banner', (uploaded) =>
                onChange((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    bannerUrl: uploaded?.url || '',
                    bannerPublicId: uploaded?.publicId || '',
                  },
                })),
              )
            }
            onRemove={() =>
              onChange((current) => ({
                ...current,
                business: {
                  ...current.business,
                  bannerUrl: '',
                  bannerPublicId: '',
                },
              }))
            }
          />
        </div>

        <div className="admin-form-grid">
          <AdminField label="WhatsApp">
            <input
              disabled={!canEdit}
              value={draft.business?.contact?.whatsapp || ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: {
                      ...(current.business?.contact || {}),
                      whatsapp: event.target.value,
                    },
                  },
                }))
              }
            />
          </AdminField>
          <AdminField label="Telefone">
            <input
              disabled={!canEdit}
              value={draft.business?.contact?.phone || ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: {
                      ...(current.business?.contact || {}),
                      phone: event.target.value,
                    },
                  },
                }))
              }
            />
          </AdminField>
          <AdminField label="E-mail" error={validationErrors['business.contact.email']}>
            <input
              disabled={!canEdit}
              type="email"
              value={draft.business?.contact?.email || ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: {
                      ...(current.business?.contact || {}),
                      email: event.target.value,
                    },
                  },
                }))
              }
              {...getInputState(validationErrors['business.contact.email'])}
            />
          </AdminField>
        </div>

        <AdminField label="Endereco">
          <input
            disabled={!canEdit}
            value={draft.business?.address?.display || ''}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                business: {
                  ...current.business,
                  address: {
                    ...(current.business?.address || {}),
                    display: event.target.value,
                  },
                },
              }))
            }
          />
        </AdminField>

        <div className="admin-card-stack">
          <div className="admin-inline-actions">
            <strong>Horarios de atendimento</strong>
            {canEdit ? (
              <Button
                variant="secondary"
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      hours: [...(current.business?.hours || []), newHourItem()],
                    },
                  }))
                }
              >
                Adicionar horario
              </Button>
            ) : null}
          </div>

          {(draft.business?.hours || []).map((hour, index) => (
            <div key={hour.id || index} className="admin-form-grid">
              <AdminField label="Dia ou periodo">
                <input
                  disabled={!canEdit}
                  value={hour.label || ''}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        hours: (current.business?.hours || []).map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value } : item,
                        ),
                      },
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Faixa de horario">
                <input
                  disabled={!canEdit}
                  value={hour.value || ''}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        hours: (current.business?.hours || []).map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value: event.target.value } : item,
                        ),
                      },
                    }))
                  }
                />
              </AdminField>
              {canEdit ? (
                <div className="admin-inline-actions">
                  <Button
                    variant="secondary"
                    className="button--danger-tone"
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        business: {
                          ...current.business,
                          hours: (current.business?.hours || []).filter((_, itemIndex) => itemIndex !== index),
                        },
                      }))
                    }
                  >
                    Remover
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="admin-inline-actions">
          <Button disabled={!canEdit || saving} onClick={onSave}>
            {saving ? 'Salvando...' : 'Salvar dados basicos'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ClientPanelPage() {
  const {
    token,
    user,
    subscription,
    access,
    logout,
    isSuspendedClientAccess,
  } = useAuth();
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingBasics, setSavingBasics] = useState(false);
  const [moduleBusyKey, setModuleBusyKey] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');

  const capabilities = access?.capabilities || {};
  const validationErrors = useMemo(
    () => (draft ? extractBasicValidationErrors(buildValidationErrors(draft)) : {}),
    [draft],
  );
  const publicUrl = editor?.business?.publicUrl || (editor?.business?.slug ? `/site/${editor.business.slug}` : '');
  const canSeeBasicsCard = Boolean(capabilities.canEditTenantBasics);

  const loadBusiness = useCallback(async () => {
    if (!token) {
      return null;
    }

    const nextEditor = await fetchClientPanelBusiness(token);
    setEditor(nextEditor);
    setDraft(cloneDeep(nextEditor));
    return nextEditor;
  }, [token]);

  const loadAnalytics = useCallback(async () => {
    if (!token || !capabilities.canViewAnalytics) {
      setAnalytics(null);
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError('');

    try {
      setAnalytics(await fetchClientPanelAnalytics(token));
    } catch (analyticsLoadError) {
      setAnalyticsError(getErrorMessage(analyticsLoadError));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [capabilities.canViewAnalytics, token]);

  useEffect(() => {
    let active = true;

    async function bootstrapClientPanel() {
      if (!token || isSuspendedClientAccess) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const nextEditor = await fetchClientPanelBusiness(token);

        if (!active) {
          return;
        }

        setEditor(nextEditor);
        setDraft(cloneDeep(nextEditor));
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    bootstrapClientPanel();

    return () => {
      active = false;
    };
  }, [isSuspendedClientAccess, token]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const refreshAfterModuleAction = useCallback(
    async (busyKey, action, successMessage) => {
      setModuleBusyKey(busyKey);
      setMessage('');
      setError('');

      try {
        await action();
        await loadBusiness();
        await loadAnalytics();
        if (successMessage) {
          setMessage(successMessage);
        }
      } catch (actionError) {
        setError(getErrorMessage(actionError));
      } finally {
        setModuleBusyKey('');
      }
    },
    [loadAnalytics, loadBusiness],
  );

  const moduleActions = useMemo(
    () => ({
      createProduct: (payload) =>
        refreshAfterModuleAction('create-product', () => createClientPanelProduct(token, payload), 'Produto salvo com sucesso.'),
      updateProduct: (productId, payload) =>
        refreshAfterModuleAction('update-product', () => updateClientPanelProduct(token, productId, payload), 'Produto atualizado com sucesso.'),
      deleteProduct: (productId) =>
        refreshAfterModuleAction('delete-product', () => deleteClientPanelProduct(token, productId), 'Produto removido com sucesso.'),
      createProfessional: (payload) =>
        refreshAfterModuleAction('create-professional', () => createClientPanelProfessional(token, payload), 'Profissional salvo com sucesso.'),
      updateProfessional: (professionalId, payload) =>
        refreshAfterModuleAction('update-professional', () => updateClientPanelProfessional(token, professionalId, payload), 'Profissional atualizado com sucesso.'),
      deleteProfessional: (professionalId) =>
        refreshAfterModuleAction('delete-professional', () => deleteClientPanelProfessional(token, professionalId), 'Profissional removido com sucesso.'),
      createAppointmentService: (payload) =>
        refreshAfterModuleAction('create-appointment-service', () => createClientPanelAppointmentService(token, payload), 'Servico salvo com sucesso.'),
      updateAppointmentService: (serviceId, payload) =>
        refreshAfterModuleAction('update-appointment-service', () => updateClientPanelAppointmentService(token, serviceId, payload), 'Servico atualizado com sucesso.'),
      deleteAppointmentService: (serviceId) =>
        refreshAfterModuleAction('delete-appointment-service', () => deleteClientPanelAppointmentService(token, serviceId), 'Servico removido com sucesso.'),
      updateOrderStatus: (orderId, status) =>
        refreshAfterModuleAction('update-order-status', () => updateClientPanelOrderStatus(token, orderId, status), 'Status do pedido atualizado com sucesso.'),
      updateAppointmentRequestStatus: (requestId, status) =>
        refreshAfterModuleAction('update-appointment-request-status', () => updateClientPanelAppointmentRequestStatus(token, requestId, status), 'Status do agendamento atualizado com sucesso.'),
    }),
    [refreshAfterModuleAction, token],
  );

  async function handleSaveBasics() {
    if (!draft || !capabilities.canEditTenantBasics) {
      return;
    }

    if (Object.keys(validationErrors).length) {
      setError('Corrija os campos basicos destacados antes de salvar.');
      return;
    }

    setSavingBasics(true);
    setMessage('');
    setError('');

    try {
      const updatedEditor = await updateClientPanelBusinessBasics(token, buildBasicBusinessPayload(draft));
      setEditor(updatedEditor);
      setDraft(cloneDeep(updatedEditor));
      setMessage('Dados basicos atualizados com sucesso.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingBasics(false);
    }
  }

  async function handleUpload(file, options = {}) {
    setMessage('');
    setError('');

    try {
      return await uploadClientPanelImage(token, file, options);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
      throw uploadError;
    }
  }

  if (isSuspendedClientAccess) {
    return (
      <AppShell
        eyebrow="TapLink Painel"
        title="Acesso temporariamente suspenso"
        description="Seu tenant continua vinculado ao painel, mas o acesso esta bloqueado ate a regularizacao com o suporte."
        shellClassName="dashboard-shell"
        heroClassName="dashboard-shell__hero"
        contentClassName="dashboard-shell__content"
        pageTitle="TapLink | Acesso suspenso"
      >
        <Card className="admin-panel-card admin-panel-card--hero">
          <div className="admin-editor-header">
            <div>
              <h2>Painel indisponivel no momento</h2>
              <p>Entre em contato com o suporte TapLink para revisar o status financeiro ou operacional do seu acesso.</p>
            </div>
            <div className="admin-toolbar">
              <Button variant="secondary" onClick={logout}>
                Sair
              </Button>
            </div>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="TapLink Painel"
      title={editor?.business?.name || 'Painel do cliente'}
      description="Acompanhe pedidos, agendamentos, catalogo e dados basicos do seu tenant com acesso limitado por nivel, plano e status financeiro."
      shellClassName="dashboard-shell"
      heroClassName="dashboard-shell__hero"
      contentClassName="dashboard-shell__content"
      pageTitle={`TapLink | ${editor?.business?.name || 'Painel do cliente'}`}
    >
      <Card className="admin-panel-card admin-panel-card--hero">
        <div className="admin-editor-header">
          <div>
            <h2>Operacao do tenant</h2>
            <p>
              Logado como <strong>{user?.displayName || 'Usuario'}</strong>. Este painel respeita seu nivel de acesso, o plano do tenant e o status financeiro atual.
            </p>
          </div>
          <div className="admin-toolbar">
            <div className="admin-toolbar__group">
              {publicUrl ? (
                <Button href={publicUrl} target="_blank" rel="noreferrer">
                  Abrir pagina publica
                </Button>
              ) : null}
            </div>
            <div className="admin-toolbar__group admin-toolbar__group--end">
              <Button variant="secondary" onClick={logout}>
                Sair
              </Button>
            </div>
          </div>
        </div>

        <div className="admin-mini-stats">
          <AnalyticsMetric label="Plano" value={subscription?.plan?.name || subscription?.plan?.code || 'Plano'} description="Plano resolvido pelo tenant vinculado." />
          <AnalyticsMetric label="Status financeiro" value={BILLING_ACCESS_LABELS[access?.billingStatus] || access?.billingStatus || 'Pago'} description="Bloqueios operacionais seguem este status." />
          <AnalyticsMetric label="Nivel de acesso" value={ROLE_LEVEL_LABELS[user?.roleLevel] || `Nivel ${user?.roleLevel ?? '-'}`} description="Seu escopo de leitura e edicao no painel." />
          <AnalyticsMetric label="Analytics" value={ANALYTICS_SCOPE_LABELS[access?.analyticsScope] || 'Sem analytics'} description="Escopo combinado entre plano e nivel do usuario." />
        </div>
      </Card>

      <BillingBanner billingStatus={access?.billingStatus} />
      {message ? <p className="admin-status-banner admin-status-banner--success">{message}</p> : null}
      {error ? <p className="admin-status-banner admin-status-banner--error">{error}</p> : null}

      {loading && !editor ? (
        <EmptyState title="Carregando painel do tenant" description="Buscando dados do seu negocio, modulos ativos e permissoes do seu acesso." />
      ) : editor && draft ? (
        <div className="admin-dashboard-flow">
          {canSeeBasicsCard ? (
            <BasicSettingsCard
              draft={draft}
              validationErrors={validationErrors}
              saving={savingBasics}
              canEdit={Boolean(capabilities.canEditTenantBasics)}
              canUploadMedia={Boolean(capabilities.canUploadMedia)}
              onChange={(updater) => setDraft((current) => (typeof updater === 'function' ? updater(cloneDeep(current)) : updater))}
              onUpload={handleUpload}
              onSave={handleSaveBasics}
            />
          ) : null}

          <Card className="admin-panel-card">
            <TenantModuleManagementSection
              draft={draft}
              onDraftChange={setDraft}
              moduleActions={moduleActions}
              busyKey={moduleBusyKey}
              onUpload={handleUpload}
              mode="client"
              permissions={capabilities}
            />
          </Card>

          {capabilities.canViewAnalytics ? (
            <Card className="admin-panel-card">
              <div className="admin-panel-card__header">
                <div>
                  <SectionEyebrow>Analytics</SectionEyebrow>
                  <h2>Visao do tenant</h2>
                  <p>Resumo liberado pelo seu plano e pelo seu nivel de acesso atual.</p>
                </div>
              </div>

              {analyticsLoading ? <p className="admin-muted-copy">Carregando analytics do tenant...</p> : null}
              {analyticsError ? <p className="admin-status-banner admin-status-banner--error">{analyticsError}</p> : null}

              {analytics ? (
                <div className="admin-mini-stats">
                  <AnalyticsMetric label="Eventos" value={analytics.totals?.totalEvents ?? 0} description="Tudo que o tenant registrou ate agora." />
                  <AnalyticsMetric label="Ultimos 7 dias" value={analytics.totals?.last7DaysEvents ?? 0} description="Atividade recente da pagina publica." />
                  <AnalyticsMetric label="Visitas" value={analytics.totals?.pageViews ?? 0} description="Page views registradas no tenant." />
                  <AnalyticsMetric label="Escopo" value={ANALYTICS_SCOPE_LABELS[analytics.scope] || analytics.scope} description="Nivel de analytics liberado neste painel." />
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      ) : (
        <EmptyState title="Nao foi possivel abrir o tenant" description="Recarregue a pagina ou entre em contato com o suporte se o problema persistir." />
      )}
    </AppShell>
  );
}
