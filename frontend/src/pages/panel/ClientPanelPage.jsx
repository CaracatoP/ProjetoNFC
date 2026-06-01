import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANALYTICS_SCOPE_LABELS,
  BILLING_ACCESS_LABELS,
  ROLE_LEVEL_LABELS,
} from '@shared/constants/access.js';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
} from '@shared/constants/index.js';
import { PLAN_CAPABILITY_DEFINITIONS, PLAN_TYPES } from '@shared/constants/plans.js';
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
import { subscribeToTenantUpdates } from '@/services/tenantRealtimeService.js';
import {
  createClientPanelAppointmentService,
  createClientPanelProduct,
  createClientPanelProfessional,
  deleteClientPanelAppointmentService,
  deleteClientPanelOrder,
  deleteClientPanelProduct,
  deleteClientPanelProfessional,
  fetchClientPanelAnalytics,
  fetchClientPanelBusiness,
  updateClientPanelOrderPaymentStatus,
  updateClientPanelAppointmentRequestStatus,
  updateClientPanelAppointmentService,
  updateClientPanelBusinessBasics,
  updateClientPanelOrderStatus,
  updateClientPanelProduct,
  updateClientPanelProfessional,
  uploadClientPanelImage,
} from '@/services/clientPanelService.js';

const ACCESS_REFRESH_EVENT_KINDS = new Set(['plan_updated', 'billing_updated', 'client_access_updated']);

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
      paymentSettings: draft.business?.paymentSettings || {},
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

function hasUnsavedDraft(currentDraft, currentEditor) {
  return JSON.stringify(currentDraft || null) !== JSON.stringify(currentEditor || null);
}

function mergeBasicDraftIntoEditor(nextEditor, currentDraft) {
  if (!currentDraft) {
    return cloneDeep(nextEditor);
  }

  const basicDraft = buildBasicBusinessPayload(currentDraft).business;

  return {
    ...cloneDeep(nextEditor),
    business: {
      ...(nextEditor?.business || {}),
      ...basicDraft,
      address: basicDraft.address || nextEditor?.business?.address || {},
      hours: basicDraft.hours || nextEditor?.business?.hours || [],
      contact: basicDraft.contact || nextEditor?.business?.contact || {},
      seo: basicDraft.seo || nextEditor?.business?.seo || {},
    },
  };
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

function formatMetricValue(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString('pt-BR');
}

function buildClientDailySeries(dailyEvents = []) {
  const aggregated = new Map();

  (dailyEvents || []).forEach((item) => {
    const date = item?._id?.day;

    if (!date) {
      return;
    }

    const current = aggregated.get(date) || {
      date,
      totalEvents: 0,
      pageViews: 0,
      interactions: 0,
    };

    current.totalEvents += Number(item?.count || 0);

    if (item?._id?.eventType === 'page_view') {
      current.pageViews += Number(item?.count || 0);
    } else {
      current.interactions += Number(item?.count || 0);
    }

    aggregated.set(date, current);
  });

  return [...aggregated.values()]
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(-7);
}

function ClientAnalyticsMetricCard({ label, value, description, accent = 'default' }) {
  return (
    <div className={`analytics-metric-card analytics-metric-card--${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

function ClientAnalyticsBarList({ title, description, items = [], emptyText = 'Sem dados suficientes ainda.' }) {
  const maxValue = Math.max(1, ...items.map((item) => Number(item?.count || 0)));

  return (
    <div className="admin-subpanel analytics-panel">
      <div className="admin-panel-card__header admin-panel-card__header--compact">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {items.length ? (
        <div className="analytics-bar-list">
          {items.map((item) => (
            <div key={item.key || item.label || item.eventType} className="analytics-bar-list__item">
              <div className="analytics-bar-list__copy">
                <strong>{item.label}</strong>
                {item.subtitle ? <span>{item.subtitle}</span> : null}
              </div>
              <div className="analytics-bar-list__meta">
                <b>{formatMetricValue(item.count)}</b>
                <div className="analytics-bar-list__track" aria-hidden="true">
                  <span style={{ width: `${Math.max(10, ((item.count || 0) / maxValue) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state analytics-empty-state--compact">
          <strong>{emptyText}</strong>
          <span>Assim que o tenant ganhar mais uso real, este bloco sera preenchido automaticamente.</span>
        </div>
      )}
    </div>
  );
}

function ClientAnalyticsTrend({ series = [] }) {
  const maxTotal = Math.max(1, ...series.map((point) => point.totalEvents || 0));
  const maxViews = Math.max(1, ...series.map((point) => point.pageViews || 0));
  const maxInteractions = Math.max(1, ...series.map((point) => point.interactions || 0));
  const hasData = series.some((point) => point.totalEvents > 0 || point.pageViews > 0 || point.interactions > 0);

  return (
    <div className="admin-subpanel analytics-panel">
      <div className="admin-panel-card__header admin-panel-card__header--compact">
        <div>
          <h2>Ritmo recente</h2>
          <p>Leitura simples dos ultimos dias para acompanhar tracao do tenant.</p>
        </div>
      </div>

      {hasData ? (
        <div className="analytics-trend-chart analytics-trend-chart--compact">
          {series.map((point) => (
            <div key={point.date} className="analytics-trend-chart__day">
              <div className="analytics-trend-chart__bars" aria-hidden="true">
                <span
                  className="analytics-trend-chart__bar analytics-trend-chart__bar--events"
                  style={{ height: `${Math.max(8, (point.totalEvents / maxTotal) * 100)}%` }}
                />
                <span
                  className="analytics-trend-chart__bar analytics-trend-chart__bar--views"
                  style={{ height: `${Math.max(8, (point.pageViews / maxViews) * 100)}%` }}
                />
                <span
                  className="analytics-trend-chart__bar analytics-trend-chart__bar--actions"
                  style={{ height: `${Math.max(8, (point.interactions / maxInteractions) * 100)}%` }}
                />
              </div>
              <div className="analytics-trend-chart__label">
                <strong>{point.totalEvents}</strong>
                <span>{new Date(`${point.date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state analytics-empty-state--compact">
          <strong>Sem volume suficiente ainda</strong>
          <span>Assim que o tenant receber visitas e cliques reais, o ritmo aparece aqui.</span>
        </div>
      )}
    </div>
  );
}

function ClientAnalyticsRecentEvents({ events = [] }) {
  return (
    <div className="admin-subpanel analytics-panel">
      <div className="admin-panel-card__header admin-panel-card__header--compact">
        <div>
          <h2>Eventos recentes</h2>
          <p>Ultimas interacoes publicas consideradas no baseline atual.</p>
        </div>
      </div>

      {events.length ? (
        <div className="admin-event-list admin-event-list--scroll analytics-recent-events">
          {events.map((event) => (
            <div key={event.id || `${event.eventType}-${event.occurredAt}`} className="admin-event-item admin-event-item--analytics">
              <div>
                <strong>{event.targetLabel || event.targetType || event.eventType}</strong>
                <span>{event.eventType}</span>
              </div>
              <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state analytics-empty-state--compact">
          <strong>Sem eventos recentes</strong>
          <span>Os ultimos acessos e interacoes do tenant aparecerao aqui.</span>
        </div>
      )}
    </div>
  );
}

function ClientAnalyticsUpgradePanel({ planCode = PLAN_TYPES.STARTER }) {
  const currentPlan = PLAN_CAPABILITY_DEFINITIONS[planCode] || PLAN_CAPABILITY_DEFINITIONS[PLAN_TYPES.STARTER];

  return (
    <div className="admin-subpanel client-analytics-upgrade">
      <span className="section-eyebrow">Upgrade</span>
      <h3>Analytics indisponivel no plano atual</h3>
      <p>
        O plano <strong>{currentPlan.label}</strong> ainda nao libera a leitura de desempenho deste tenant. Faça upgrade para acompanhar visitas, pedidos, agendamentos e interacoes reais.
      </p>
      <div className="admin-module-badges">
        <span className="admin-section-chip admin-section-chip--accent">Pro: analytics basico</span>
        <span className="admin-section-chip admin-section-chip--warning">Premium: analytics avancado</span>
        <span className="admin-section-chip">Enterprise: visao completa</span>
      </div>
    </div>
  );
}

function ClientAnalyticsPanel({ analytics, analyticsLoading, analyticsError, scope, planCode }) {
  const timeline = useMemo(() => buildClientDailySeries(analytics?.dailyEvents), [analytics?.dailyEvents]);
  const canShowBreakdowns = scope === 'basic' || scope === 'advanced' || scope === 'full';
  const canShowAdvanced = scope === 'advanced' || scope === 'full';

  return (
    <Card className="admin-panel-card client-analytics-card">
      <div className="admin-panel-card__header">
        <div>
          <SectionEyebrow>Analytics</SectionEyebrow>
          <h2>Visao do tenant</h2>
          <p>Resumo liberado pelo seu plano e pelo seu nivel de acesso atual.</p>
        </div>
        <div className="client-analytics-card__scope">
          <span className={`admin-section-chip admin-section-chip--${scope === 'none' ? 'muted' : scope === 'summary' ? 'accent' : scope === 'basic' ? 'info' : scope === 'advanced' ? 'warning' : 'success'}`}>
            {ANALYTICS_SCOPE_LABELS[scope] || scope}
          </span>
        </div>
      </div>

      {scope === 'none' ? <ClientAnalyticsUpgradePanel planCode={planCode} /> : null}

      {scope !== 'none' ? (
        <>
          {analytics?.baselineAt ? (
            <div className="analytics-baseline-banner analytics-baseline-banner--inline">
              <div>
                <strong>Contando desde {formatDateTime(analytics.baselineAt)}</strong>
                <span>O dashboard do tenant esta considerando apenas eventos posteriores ao baseline atual.</span>
              </div>
            </div>
          ) : null}

          {analyticsLoading ? <p className="admin-muted-copy">Carregando analytics do tenant...</p> : null}
          {analyticsError ? <p className="admin-status-banner admin-status-banner--error">{analyticsError}</p> : null}

          {analytics ? (
            <div className="client-analytics-stack">
              <div className="analytics-metric-grid analytics-metric-grid--tenant">
                <ClientAnalyticsMetricCard label="Eventos" value={formatMetricValue(analytics.totals?.totalEvents)} description="Tudo que o tenant registrou ate agora." accent="default" />
                <ClientAnalyticsMetricCard label="Ultimos 7 dias" value={formatMetricValue(analytics.totals?.last7DaysEvents)} description="Atividade recente da pagina publica." accent="warning" />
                <ClientAnalyticsMetricCard label="Visitas" value={formatMetricValue(analytics.totals?.pageViews)} description="Page views contabilizadas no periodo." accent="info" />
                <ClientAnalyticsMetricCard label="Cliques" value={formatMetricValue((analytics.totals?.linkClicks || 0) + (analytics.totals?.ctaClicks || 0) + (analytics.totals?.copyActions || 0))} description="Links, CTAs e copias registradas." accent="accent" />
                {canShowAdvanced ? (
                  <ClientAnalyticsMetricCard label="Visitantes unicos" value={formatMetricValue(analytics.uniqueVisitors)} description="Base anonima estimada de visitantes reais." accent="success" />
                ) : null}
                <ClientAnalyticsMetricCard label="Escopo liberado" value={ANALYTICS_SCOPE_LABELS[scope] || scope} description="Resultado final entre plano e nivel de acesso." accent="success" />
              </div>

              {scope === 'summary' ? (
                <div className="analytics-baseline-banner analytics-baseline-banner--inline">
                  <div>
                    <strong>Resumo liberado</strong>
                    <span>Seu acesso atual permite uma leitura enxuta. Para ver rankings e historico mais detalhado, evolua o plano ou o nivel liberado.</span>
                  </div>
                </div>
              ) : null}

              {canShowBreakdowns ? (
                <div className="analytics-layout-grid analytics-layout-grid--client">
                  <ClientAnalyticsTrend series={timeline} />
                  <ClientAnalyticsBarList
                    title="Mix de eventos"
                    description="Quais interacoes aparecem com mais frequencia no tenant."
                    items={(analytics.byEventType || []).map((item) => ({
                      key: item.eventType,
                      label: item.label,
                      count: item.count,
                    }))}
                    emptyText="Nenhum tipo de evento registrado ainda."
                  />
                  <ClientAnalyticsBarList
                    title="Alvos mais acionados"
                    description="Atalhos, links e CTAs com maior conversao no tenant."
                    items={(analytics.topTargets || []).map((item) => ({
                      key: `${item.targetType}-${item.targetLabel}`,
                      label: item.label,
                      subtitle: item.targetType,
                      count: item.count,
                    }))}
                    emptyText="Nenhum atalho ou link acionado ainda."
                  />
                  {canShowAdvanced ? <ClientAnalyticsRecentEvents events={analytics.recentEvents || []} /> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
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
  collapsible = false,
}) {
  const [uploadingField, setUploadingField] = useState('');
  const [collapsed, setCollapsed] = useState(false);

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
        {collapsible ? (
          <div className="admin-toolbar__group admin-toolbar__group--end">
            <Button
              variant="secondary"
              onClick={() => setCollapsed((current) => !current)}
              aria-label={collapsed ? 'Expandir configuracoes basicas' : 'Minimizar configuracoes basicas'}
            >
              {collapsed ? 'Expandir' : 'Minimizar'}
            </Button>
          </div>
        ) : null}
      </div>

      {!canEdit ? <p className="admin-muted-copy">Seu nivel atual pode visualizar esses dados, mas nao editar esta area.</p> : null}

      {collapsed ? (
        <p className="admin-muted-copy">Expanda esta secao quando quiser editar nome, contato, horarios e imagens basicas do tenant.</p>
      ) : null}

      {!collapsed ? (
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

        <section className="admin-form-block admin-form-block--soft">
          <div className="admin-panel-card__header admin-panel-card__header--compact">
            <div>
              <h2>Pagamentos do checkout</h2>
              <p>Ative os metodos aceitos no catalogo publico. O Pix manual gera QR Code e copia e cola no pedido.</p>
            </div>
          </div>

          <div className="admin-card-stack">
            <label className="admin-module-card admin-module-card--compact">
              <input
                type="checkbox"
                checked={Boolean(draft.business?.paymentSettings?.enabled)}
                disabled={!canEdit}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      paymentSettings: {
                        ...(current.business?.paymentSettings || {}),
                        enabled: event.target.checked,
                      },
                    },
                  }))
                }
              />
              <div>
                <strong>Checkout com pagamento</strong>
                <span>Controla se o catalogo publico mostra formas de pagamento no fechamento do pedido.</span>
              </div>
            </label>

            <div className="admin-module-grid admin-module-grid--payments">
              <label className="admin-module-card admin-module-card--compact">
                <input
                  type="checkbox"
                  checked={Boolean(draft.business?.paymentSettings?.methods?.pix)}
                  disabled={!canEdit}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        paymentSettings: {
                          ...(current.business?.paymentSettings || {}),
                          methods: {
                            ...(current.business?.paymentSettings?.methods || {}),
                            pix: event.target.checked,
                          },
                        },
                      },
                    }))
                  }
                />
                <div>
                  <strong>Pix</strong>
                  <span>Mostra QR Code e codigo copia e cola apos criar o pedido.</span>
                </div>
              </label>

              <label className="admin-module-card admin-module-card--compact">
                <input
                  type="checkbox"
                  checked={Boolean(draft.business?.paymentSettings?.methods?.cashOnPickup)}
                  disabled={!canEdit}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        paymentSettings: {
                          ...(current.business?.paymentSettings || {}),
                          methods: {
                            ...(current.business?.paymentSettings?.methods || {}),
                            cashOnPickup: event.target.checked,
                          },
                        },
                      },
                    }))
                  }
                />
                <div>
                  <strong>Pagamento na retirada</strong>
                  <span>Cliente finaliza agora e paga ao retirar o pedido.</span>
                </div>
              </label>

              <label className="admin-module-card admin-module-card--compact">
                <input
                  type="checkbox"
                  checked={Boolean(draft.business?.paymentSettings?.methods?.cashOnDelivery)}
                  disabled={!canEdit}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        paymentSettings: {
                          ...(current.business?.paymentSettings || {}),
                          methods: {
                            ...(current.business?.paymentSettings?.methods || {}),
                            cashOnDelivery: event.target.checked,
                          },
                        },
                      },
                    }))
                  }
                />
                <div>
                  <strong>Pagamento na entrega</strong>
                  <span>Cliente finaliza agora e paga no momento em que receber o pedido.</span>
                </div>
              </label>
            </div>

            <div className="admin-inline-note admin-inline-note--preview">
              <strong>Cartoes preparados para depois</strong>
              <span>Credito e debito ficam reservados para o momento em que houver Stripe, Mercado Pago ou outro gateway seguro.</span>
            </div>

            <div className="admin-form-grid">
              <AdminField label="Tipo de chave Pix">
                <select
                  disabled={!canEdit}
                  value={draft.business?.contact?.pix?.keyType || ''}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...(current.business?.contact || {}),
                          pix: {
                            ...(current.business?.contact?.pix || {}),
                            keyType: event.target.value,
                          },
                        },
                      },
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Aleatoria</option>
                </select>
              </AdminField>

              <AdminField label="Chave Pix">
                <input
                  disabled={!canEdit}
                  value={draft.business?.paymentSettings?.pix?.key || ''}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...(current.business?.contact || {}),
                          pix: {
                            ...(current.business?.contact?.pix || {}),
                            key: event.target.value,
                          },
                        },
                        paymentSettings: {
                          ...(current.business?.paymentSettings || {}),
                          pix: {
                            ...(current.business?.paymentSettings?.pix || {}),
                            key: event.target.value,
                          },
                        },
                      },
                    }))
                  }
                />
              </AdminField>

              <AdminField label="Recebedor Pix">
                <input
                  disabled={!canEdit}
                  value={draft.business?.paymentSettings?.pix?.merchantName || ''}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...(current.business?.contact || {}),
                          pix: {
                            ...(current.business?.contact?.pix || {}),
                            receiverName: event.target.value,
                          },
                        },
                        paymentSettings: {
                          ...(current.business?.paymentSettings || {}),
                          pix: {
                            ...(current.business?.paymentSettings?.pix || {}),
                            merchantName: event.target.value,
                          },
                        },
                      },
                    }))
                  }
                />
              </AdminField>

              <AdminField label="Cidade do Pix">
                <input
                  disabled={!canEdit}
                  value={draft.business?.paymentSettings?.pix?.merchantCity || ''}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...(current.business?.contact || {}),
                          pix: {
                            ...(current.business?.contact?.pix || {}),
                            city: event.target.value,
                          },
                        },
                        paymentSettings: {
                          ...(current.business?.paymentSettings || {}),
                          pix: {
                            ...(current.business?.paymentSettings?.pix || {}),
                            merchantCity: event.target.value,
                          },
                        },
                      },
                    }))
                  }
                />
              </AdminField>
            </div>
          </div>
        </section>

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
      ) : null}
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
    refreshSession,
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
  const editorRef = useRef(null);
  const draftRef = useRef(null);
  const skipNextAnalyticsEffectRef = useRef(false);

  const capabilities = access?.capabilities || {};
  const analyticsScope = access?.analyticsScope || 'none';
  const planCode = subscription?.plan?.code || PLAN_TYPES.STARTER;
  const canSeeAnalyticsSection = (user?.roleLevel ?? 5) <= 4;
  const validationErrors = useMemo(
    () => (draft ? extractBasicValidationErrors(buildValidationErrors(draft)) : {}),
    [draft],
  );
  const publicUrl = editor?.business?.publicUrl || (editor?.business?.slug ? `/site/${editor.business.slug}` : '');
  const canSeeBasicsCard = Boolean(capabilities.canEditTenantBasics);

  const loadBusiness = useCallback(async () => {
    const currentEditor = editorRef.current;
    const currentDraft = draftRef.current;
    if (!token) {
      return null;
    }

    const nextEditor = await fetchClientPanelBusiness(token);
    setEditor(nextEditor);
    setDraft(hasUnsavedDraft(currentDraft, currentEditor) ? mergeBasicDraftIntoEditor(nextEditor, currentDraft) : cloneDeep(nextEditor));
    return nextEditor;
  }, [token]);

  const loadAnalytics = useCallback(async (accessOverride = null) => {
    const nextAccess = accessOverride || access;

    if (!token || !nextAccess?.capabilities?.canViewAnalytics) {
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
  }, [access, token]);

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
    if (skipNextAnalyticsEffectRef.current) {
      skipNextAnalyticsEffectRef.current = false;
      return;
    }

    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!token || isSuspendedClientAccess || !editor?.business?.id) {
      return undefined;
    }

    let active = true;

    const unsubscribe = subscribeToTenantUpdates(
      {
        businessId: editor.business.id,
        slug: editor.business.slug,
      },
      {
        async onTenantUpdated(event = {}) {
          if (!active) {
            return;
          }

          try {
            if (ACCESS_REFRESH_EVENT_KINDS.has(event.kind) && typeof refreshSession === 'function') {
              const nextSession = await refreshSession();

              if (!active) {
                return;
              }

              const nextAccess = nextSession?.access || access;
              const nextBillingStatus = nextAccess?.billingStatus || '';

              if (nextBillingStatus === 'suspended' || nextBillingStatus === 'cancelled') {
                setAnalytics(null);
                return;
              }

              skipNextAnalyticsEffectRef.current = true;
              await Promise.all([loadBusiness(), loadAnalytics(nextAccess)]);
              return;
            }

            await Promise.all([loadBusiness(), loadAnalytics()]);
          } catch (refreshError) {
            if (!active) {
              return;
            }

            setError(getErrorMessage(refreshError));
          }
        },
      },
    );

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [access, editor?.business?.id, editor?.business?.slug, isSuspendedClientAccess, loadAnalytics, loadBusiness, refreshSession, token]);

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
      updateOrderPaymentStatus: (orderId, status) =>
        refreshAfterModuleAction('update-order-payment-status', () => updateClientPanelOrderPaymentStatus(token, orderId, status), 'Status do pagamento atualizado com sucesso.'),
      deleteOrder: (orderId) =>
        refreshAfterModuleAction('delete-order', () => deleteClientPanelOrder(token, orderId), 'Pedido arquivado com sucesso.'),
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
              collapsible
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

          {canSeeAnalyticsSection ? (
            <ClientAnalyticsPanel
              analytics={analytics}
              analyticsLoading={analyticsLoading}
              analyticsError={analyticsError}
              scope={analytics?.scope || analyticsScope}
              planCode={planCode}
            />
          ) : null}
        </div>
      ) : (
        <EmptyState title="Nao foi possivel abrir o tenant" description="Recarregue a pagina ou entre em contato com o suporte se o problema persistir." />
      )}
    </AppShell>
  );
}
