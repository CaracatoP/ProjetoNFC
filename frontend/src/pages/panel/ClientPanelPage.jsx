import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useClientPanelWorkspace } from '@/hooks/useClientPanelWorkspace.js';
import { useTenantTheme } from '@/hooks/useTenantTheme.js';
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

const CLIENT_SETTINGS_SECTIONS = [
  {
    id: 'general',
    label: 'Geral',
    title: 'Identidade publica',
    description: 'Nome, descricao, selo e midia principal do negocio.',
  },
  {
    id: 'contact',
    label: 'Contato',
    title: 'Contato do negocio',
    description: 'Canais de atendimento que aparecem para o cliente final.',
  },
  {
    id: 'payments',
    label: 'Pagamento',
    title: 'Checkout e Pix',
    description: 'Metodos manuais do catalogo e dados do Pix do tenant.',
  },
  {
    id: 'operations',
    label: 'Funcionamento',
    title: 'Endereco e horarios',
    description: 'Localizacao publica e agenda basica do atendimento.',
  },
];

function extractBasicValidationErrors(validationErrors = {}) {
  return Object.fromEntries(
    Object.entries(validationErrors).filter(([path]) => BASIC_ERROR_PREFIXES.some((prefix) => path.startsWith(prefix))),
  );
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

function formatMetricValue(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString('pt-BR');
}

function formatAnalyticsFallbackLabel(value, fallback = 'Sem rotulo') {
  const normalized = String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildClientDailySeries(dailyEvents = []) {
  if ((dailyEvents || []).every((item) => item?.date)) {
    return [...dailyEvents]
      .map((item) => ({
        date: item.date,
        totalEvents: Number(item.totalEvents || 0),
        pageViews: Number(item.pageViews || 0),
        interactions: Number(item.interactions || 0),
      }))
      .sort((first, second) => first.date.localeCompare(second.date))
      .slice(-7);
  }

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
                <strong>{formatAnalyticsFallbackLabel(item.label)}</strong>
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

      <div className="analytics-legend" aria-label="Legenda do grafico de analytics">
        <span>
          <i className="analytics-trend-chart__bar analytics-trend-chart__bar--events" aria-hidden="true" />
          Eventos
        </span>
        <span>
          <i className="analytics-trend-chart__bar analytics-trend-chart__bar--views" aria-hidden="true" />
          Visitas
        </span>
        <span>
          <i className="analytics-trend-chart__bar analytics-trend-chart__bar--actions" aria-hidden="true" />
          Interacoes
        </span>
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
                <strong>{formatAnalyticsFallbackLabel(event.displayLabel || event.targetLabel || event.targetTypeLabel || event.eventTypeLabel || event.eventType)}</strong>
                <span>{formatAnalyticsFallbackLabel(event.eventTypeLabel || event.eventType, 'Evento')}</span>
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
  const timeline = useMemo(
    () => buildClientDailySeries(analytics?.timeline || analytics?.dailyEvents),
    [analytics?.dailyEvents, analytics?.timeline],
  );
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
                <ClientAnalyticsMetricCard label="Eventos" value={formatMetricValue(analytics.metrics?.totalEvents || analytics.totals?.totalEvents)} description="Tudo que o tenant registrou ate agora." accent="default" />
                <ClientAnalyticsMetricCard label="Ultimos 7 dias" value={formatMetricValue(analytics.totals?.last7DaysEvents)} description="Atividade recente da pagina publica." accent="warning" />
                <ClientAnalyticsMetricCard label="Visitas" value={formatMetricValue(analytics.metrics?.pageViews || analytics.totals?.pageViews)} description="Page views contabilizadas no periodo." accent="info" />
                <ClientAnalyticsMetricCard label="Interacoes" value={formatMetricValue(analytics.metrics?.interactions || ((analytics.totals?.linkClicks || 0) + (analytics.totals?.ctaClicks || 0) + (analytics.totals?.copyActions || 0)))} description="Links, CTAs e copias registradas." accent="accent" />
                <ClientAnalyticsMetricCard label="Taxa de acao" value={`${Number(analytics.metrics?.actionRate || 0).toFixed(1)}%`} description="Interacoes em relacao ao total de visitas." accent="warning" />
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
                      label: item.label || item.eventType,
                      subtitle: `${Number(item.share || 0).toFixed(1)}% do total`,
                      count: item.count,
                    }))}
                    emptyText="Nenhum tipo de evento registrado ainda."
                  />
                  <ClientAnalyticsBarList
                    title="Alvos mais acionados"
                    description="Atalhos, links e CTAs com maior conversao no tenant."
                    items={(analytics.topTargets || []).map((item) => ({
                      key: `${item.targetType}-${item.targetLabel}`,
                      label: item.label || item.targetLabel || item.targetTypeLabel || item.targetType,
                      subtitle: `${formatAnalyticsFallbackLabel(item.targetTypeLabel || item.targetType)} · ${Number(item.share || 0).toFixed(1)}%`,
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
  const [activeSection, setActiveSection] = useState(CLIENT_SETTINGS_SECTIONS[0].id);

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
    <Card className="admin-panel-card client-settings-card">
      <div className="admin-panel-card__header client-settings-card__header">
        <div>
          <SectionEyebrow>Configuracoes basicas</SectionEyebrow>
          <h2>Dados publicos do negocio</h2>
          <p>Atualize identidade, contato, checkout manual e funcionamento sem misturar tudo em uma pagina longa.</p>
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
        <p className="admin-muted-copy">Expanda esta secao quando quiser editar identidade, checkout, contato, localizacao e horarios.</p>
      ) : null}

      {!collapsed ? (
        <div className="admin-card-stack admin-card-stack--airy">
          <div className="client-settings-tabs" role="tablist" aria-label="Secoes de configuracoes basicas">
            {CLIENT_SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                className={`client-settings-tabs__button${activeSection === section.id ? ' is-active' : ''}`}
                aria-selected={activeSection === section.id}
                onClick={() => setActiveSection(section.id)}
              >
                <strong>{section.label}</strong>
                <span>{section.description}</span>
              </button>
            ))}
          </div>

          <section className="client-settings-panel">
            <div className="client-settings-panel__header">
              <div>
                <h3>{CLIENT_SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.title || 'Configuracoes'}</h3>
                <p>{CLIENT_SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.description || 'Ajuste apenas o grupo necessario agora.'}</p>
              </div>
            </div>

            {activeSection === 'general' ? (
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
                    rows={3}
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
              </div>
            ) : null}

            {activeSection === 'contact' ? (
              <div className="admin-card-stack admin-card-stack--airy">
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

                <div className="client-settings-note">
                  <strong>Esses canais alimentam o site publico</strong>
                  <span>WhatsApp, telefone e e-mail aparecem como caminhos de contato para o cliente final.</span>
                </div>
              </div>
            ) : null}

            {activeSection === 'payments' ? (
              <div className="admin-card-stack admin-card-stack--airy">
                <div className="client-settings-note">
                  <strong>Checkout manual do catalogo</strong>
                  <span>Ative so os meios de pagamento coerentes com a operacao atual do tenant. Cartoes continuam reservados para um gateway seguro no futuro.</span>
                </div>

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
                      <span>Cliente finaliza agora e paga quando receber o pedido.</span>
                    </div>
                  </label>
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
            ) : null}

            {activeSection === 'operations' ? (
              <div className="admin-card-stack admin-card-stack--airy">
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

                <div className="client-settings-hours">
                  <div className="client-settings-hours__header">
                    <div>
                      <strong>Horarios de atendimento</strong>
                      <span>Mostre as faixas de funcionamento que fazem sentido para o site publico.</span>
                    </div>
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
                    <div key={hour.id || index} className="admin-form-grid client-settings-hours__row">
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
                        <div className="admin-inline-actions client-settings-hours__actions">
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
              </div>
            ) : null}
          </section>

          <div className="admin-inline-actions client-settings-footer">
            <Button disabled={!canEdit || saving} onClick={onSave}>
              {saving ? 'Salvando...' : 'Salvar dados basicos'}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

const CLIENT_PANEL_VIEW_COPY = Object.freeze({
  overview: {
    label: 'Visao geral',
    title: 'Visao geral do tenant',
    description: 'Leitura rapida do que importa agora e atalhos para agir sem navegar demais.',
  },
  settings: {
    label: 'Configuracoes',
    title: 'Configuracoes basicas',
    description: 'Dados publicos, contato, horarios, SEO e meios de pagamento do tenant.',
  },
  catalog: {
    label: 'Catalogo',
    title: 'Catalogo e disponibilidade',
    description: 'Produtos, categorias e disponibilidade com uma operacao mais compacta.',
  },
  stock: {
    label: 'Estoque',
    title: 'Estoque',
    description: 'Controle rapido de quantidade, minimo e itens que merecem atencao.',
  },
  orders: {
    label: 'Pedidos',
    title: 'Pedidos',
    description: 'Fila operacional com foco em status, pagamento e proxima acao.',
  },
  appointments: {
    label: 'Agendamentos',
    title: 'Agendamentos',
    description: 'Pedidos de agenda centralizados no contexto do tenant autenticado.',
  },
  professionals: {
    label: 'Profissionais',
    title: 'Profissionais',
    description: 'Equipe vinculada ao modulo de agendamentos.',
  },
  services: {
    label: 'Servicos',
    title: 'Servicos',
    description: 'Oferta de servicos organizada sem recarregar o workspace inteiro.',
  },
  analytics: {
    label: 'Analytics',
    title: 'Analytics',
    description: 'Uso real do site publico respeitando plano, nivel e baseline do tenant.',
  },
});

const CLIENT_PANEL_NAV_GROUPS = [
  { id: 'overview', label: 'Visao geral', views: ['overview'] },
  { id: 'operation', label: 'Operacao', views: ['orders', 'catalog', 'stock', 'appointments'] },
  { id: 'business', label: 'Negocio', views: ['professionals', 'services', 'analytics'] },
  { id: 'settings', label: 'Configuracoes', views: ['settings'] },
];

function buildClientNavigationGroups(views = []) {
  const viewMap = new Map(views.map((view) => [view.id, view]));

  return CLIENT_PANEL_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.views.map((viewId) => viewMap.get(viewId)).filter(Boolean),
    }))
    .filter((group) => group.items.length);
}

function buildClientPanelViews({ editor, capabilities, canSeeAnalyticsSection }) {
  const modules = editor?.business?.modules || {};
  const views = [{ id: 'overview', ...CLIENT_PANEL_VIEW_COPY.overview }];

  if (capabilities.canEditTenantBasics) {
    views.push({ id: 'settings', ...CLIENT_PANEL_VIEW_COPY.settings });
  }

  if (modules.catalog && capabilities.canViewCatalog) {
    views.push({ id: 'catalog', ...CLIENT_PANEL_VIEW_COPY.catalog });
    views.push({ id: 'stock', ...CLIENT_PANEL_VIEW_COPY.stock });
  }

  if ((modules.orders || modules.cart) && capabilities.canViewOrders) {
    views.push({ id: 'orders', ...CLIENT_PANEL_VIEW_COPY.orders });
  }

  if (modules.appointments && capabilities.canViewAppointments) {
    views.push({ id: 'appointments', ...CLIENT_PANEL_VIEW_COPY.appointments });
  }

  if (modules.appointments && capabilities.canViewProfessionals) {
    views.push({ id: 'professionals', ...CLIENT_PANEL_VIEW_COPY.professionals });
  }

  if (modules.appointments && capabilities.canViewServices) {
    views.push({ id: 'services', ...CLIENT_PANEL_VIEW_COPY.services });
  }

  if (modules.analytics && canSeeAnalyticsSection) {
    views.push({ id: 'analytics', ...CLIENT_PANEL_VIEW_COPY.analytics });
  }

  return views;
}

function getDomainStateForView(viewId, domainState = {}) {
  if (viewId === 'catalog' || viewId === 'stock') {
    return domainState.products;
  }

  if (viewId === 'orders') {
    return domainState.orders;
  }

  if (viewId === 'appointments') {
    return domainState.appointmentRequests;
  }

  if (viewId === 'professionals') {
    return domainState.professionals;
  }

  if (viewId === 'services') {
    return domainState.appointmentServices;
  }

  return null;
}

function ClientPanelSectionSkeleton({ title, description }) {
  return (
    <Card className="admin-panel-card client-panel-workspace">
      <div className="client-panel-workspace__header">
        <div>
          <span className="section-eyebrow">Carregando</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="client-panel-skeleton-grid">
        <div className="client-panel-skeleton-card" />
        <div className="client-panel-skeleton-card" />
        <div className="client-panel-skeleton-card client-panel-skeleton-card--wide" />
      </div>
    </Card>
  );
}

function OverviewKpiCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className={`client-panel-kpi client-panel-kpi--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function ClientPanelOverview({
  editor,
  subscription,
  access,
  user,
  onNavigate,
  onCopyPublicUrl,
  publicUrl,
}) {
  const summary = editor?.summary || {};
  const productSummary = summary.products || {};
  const orderSummary = summary.orders || {};
  const appointmentSummary = summary.appointments || {};
  const lowStock = Number(productSummary.lowStock || 0);
  const unavailableProducts = Number(productSummary.unavailable || 0);
  const openOrders = Number(orderSummary.open || 0);
  const pendingAppointments = Number(appointmentSummary.pending || 0);
  const modules = editor?.business?.modules || {};
  const moduleLabels = {
    catalog: 'Catalogo',
    cart: 'Carrinho',
    orders: 'Pedidos',
    appointments: 'Agendamentos',
    loyalty: 'Fidelidade',
    whatsapp: 'WhatsApp',
    analytics: 'Analytics',
  };
  const activeModules = Object.entries(modules)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => moduleLabels[key] || formatAnalyticsFallbackLabel(key));
  const operationalRows = [
    {
      label: 'Pedidos recebidos',
      value: formatMetricValue(orderSummary.received || 0),
      detail: 'Aguardando triagem inicial da operacao.',
      actionLabel: 'Abrir pedidos',
      targetView: 'orders',
    },
    {
      label: 'Em preparo',
      value: formatMetricValue(orderSummary.preparing || 0),
      detail: 'Itens que ainda exigem acompanhamento da equipe.',
      actionLabel: 'Ver fila',
      targetView: 'orders',
    },
    {
      label: 'Prontos ou retirados',
      value: formatMetricValue(orderSummary.ready || 0),
      detail: 'Pedidos quase finalizados ou aguardando retirada.',
      actionLabel: 'Checar pedidos',
      targetView: 'orders',
    },
    {
      label: 'Agendamentos pendentes',
      value: formatMetricValue(pendingAppointments),
      detail: 'Solicitacoes aguardando confirmacao do tenant.',
      actionLabel: 'Abrir agenda',
      targetView: 'appointments',
    },
  ].filter((row) => row.targetView !== 'appointments' || modules.appointments);
  const quickLinks = [
    { label: 'Editar dados basicos', targetView: 'settings' },
    { label: 'Atualizar estoque', targetView: 'stock', visible: modules.catalog },
    { label: 'Gerenciar produtos', targetView: 'catalog', visible: modules.catalog },
    { label: 'Abrir pedidos', targetView: 'orders', visible: modules.orders || modules.cart },
    { label: 'Ver agenda', targetView: 'appointments', visible: modules.appointments },
  ].filter((item) => item.visible !== false);
  const businessContact = editor?.business?.contact || {};
  const address = editor?.business?.address?.display || 'Endereco ainda nao informado';

  return (
    <div className="client-panel-overview-stack client-panel-overview-stack--redesigned">
      <section className="client-panel-overview-banner">
        <div className="client-panel-overview-banner__copy">
          <span className="section-eyebrow">Operacao do dia</span>
          <h2>{editor?.business?.name || 'Painel do cliente'}</h2>
          <p>
            Logado como <strong>{user?.displayName || 'Usuario'}</strong>. Aqui ficam os indicadores principais, a fila mais urgente e os atalhos que reduzem cliques na rotina.
          </p>
          <div className="client-panel-chip-row">
            <span className="client-panel-chip">{subscription?.plan?.name || subscription?.plan?.code || 'Plano'}</span>
            <span className="client-panel-chip client-panel-chip--muted">{BILLING_ACCESS_LABELS[access?.billingStatus] || access?.billingStatus || 'Pago'}</span>
            <span className="client-panel-chip client-panel-chip--accent">{ROLE_LEVEL_LABELS[user?.roleLevel] || `Nivel ${user?.roleLevel ?? '-'}`}</span>
            <span className="client-panel-chip client-panel-chip--info">{ANALYTICS_SCOPE_LABELS[access?.analyticsScope] || 'Sem analytics'}</span>
          </div>
        </div>
        <div className="client-panel-overview-banner__actions">
          {publicUrl ? (
            <Button href={publicUrl} target="_blank" rel="noreferrer">
              Abrir site
            </Button>
          ) : null}
          {editor?.business?.modules?.catalog ? (
            <Button variant="secondary" onClick={() => onNavigate('catalog')}>
              Gerenciar catalogo
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onCopyPublicUrl} disabled={!publicUrl}>
            Copiar link
          </Button>
        </div>
      </section>

      <div className="client-panel-kpi-grid">
        <OverviewKpiCard label="Pedidos em aberto" value={formatMetricValue(openOrders)} hint="Recebidos, em preparo e prontos." tone="info" />
        <OverviewKpiCard label="Estoque baixo" value={formatMetricValue(lowStock)} hint="Itens controlados abaixo do minimo." tone={lowStock ? 'warning' : 'default'} />
        <OverviewKpiCard label="Produtos indisponiveis" value={formatMetricValue(unavailableProducts)} hint="Visiveis no site, mas fora de venda." tone={unavailableProducts ? 'danger' : 'default'} />
        <OverviewKpiCard label="Agendamentos pendentes" value={formatMetricValue(pendingAppointments)} hint="Demandas aguardando resposta do tenant." tone={pendingAppointments ? 'accent' : 'default'} />
      </div>

      <div className="client-panel-overview-grid">
        <section className="client-panel-subpanel client-panel-subpanel--wide">
          <div className="client-panel-subpanel__header">
            <div>
              <span className="section-eyebrow">Fila operacional</span>
              <h3>O que merece atencao agora</h3>
              <p>Leitura curta da operacao para voce agir primeiro no que destrava vendas, entrega e atendimento.</p>
            </div>
          </div>
          <div className="client-panel-operational-list">
            {operationalRows.map((row) => (
              <button key={row.label} type="button" className="client-panel-operational-item" onClick={() => onNavigate(row.targetView)}>
                <div className="client-panel-operational-item__copy">
                  <strong>{row.label}</strong>
                  <span>{row.detail}</span>
                </div>
                <div className="client-panel-operational-item__meta">
                  <b>{row.value}</b>
                  <small>{row.actionLabel}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="client-panel-subpanel">
          <div className="client-panel-subpanel__header">
            <div>
              <span className="section-eyebrow">Acoes rapidas</span>
              <h3>Atalhos do dia</h3>
              <p>As tarefas mais repetidas ficam disponiveis sem precisar atravessar o painel inteiro.</p>
            </div>
          </div>
          <div className="client-panel-quick-actions client-panel-quick-actions--stacked">
            {quickLinks.map((item) => (
              <Button key={item.label} variant={item.targetView === 'settings' ? 'primary' : 'secondary'} onClick={() => onNavigate(item.targetView)}>
                {item.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="client-panel-subpanel">
          <div className="client-panel-subpanel__header">
            <div>
              <span className="section-eyebrow">Saude do tenant</span>
              <h3>Base ativa da operacao</h3>
              <p>Leitura curta da infraestrutura publica e do que ja esta pronto para vender.</p>
            </div>
          </div>
          <div className="client-panel-context-list">
            <div>
              <strong>Modulos ativos</strong>
              <span>{activeModules.length ? activeModules.join(' • ') : 'Nenhum modulo ativo ainda.'}</span>
            </div>
            <div>
              <strong>Produtos com estoque</strong>
              <span>{formatMetricValue(productSummary.controlledStock || 0)} item(ns) com controle ativo.</span>
            </div>
            <div>
              <strong>Profissionais</strong>
              <span>{formatMetricValue(summary.professionals?.total || 0)} cadastrado(s) no modulo de agenda.</span>
            </div>
            <div>
              <strong>Servicos</strong>
              <span>{formatMetricValue(summary.services?.total || 0)} oferta(s) prontas para operacao.</span>
            </div>
          </div>
        </section>

        <section className="client-panel-subpanel">
          <div className="client-panel-subpanel__header">
            <div>
              <span className="section-eyebrow">Presenca publica</span>
              <h3>Contato e vitrine</h3>
              <p>Os dados que o cliente final encontra ao abrir o site e o catalogo do tenant.</p>
            </div>
          </div>
          <div className="client-panel-context-list">
            <div>
              <strong>Endereco</strong>
              <span>{address}</span>
            </div>
            <div>
              <strong>WhatsApp</strong>
              <span>{businessContact.whatsapp || 'Nao informado'}</span>
            </div>
            <div>
              <strong>E-mail</strong>
              <span>{businessContact.email || 'Nao informado'}</span>
            </div>
            <div>
              <strong>Pagina publica</strong>
              <span>{publicUrl || 'Link ainda nao disponivel'}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
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
  const [activeView, setActiveView] = useState('overview');
  const [savingBasics, setSavingBasics] = useState(false);
  const capabilities = access?.capabilities || {};
  const analyticsScope = access?.analyticsScope || 'none';
  const planCode = subscription?.plan?.code || PLAN_TYPES.STARTER;
  const canSeeAnalyticsSection = (user?.roleLevel ?? 5) <= 4;
  const {
    editor,
    draft,
    setDraft,
    analytics,
    loading,
    analyticsLoading,
    analyticsError,
    message,
    error,
    moduleBusyKey,
    domainState,
    saveBasics,
    handleUpload,
    moduleActions,
    ensureViewData,
    setMessage,
    setError,
  } = useClientPanelWorkspace({
    token,
    access,
    refreshSession,
    isSuspendedClientAccess,
  });

  useTenantTheme(editor?.theme);

  const visibleViews = useMemo(
    () => buildClientPanelViews({ editor, capabilities, canSeeAnalyticsSection }),
    [capabilities, canSeeAnalyticsSection, editor],
  );
  const navigationGroups = useMemo(() => buildClientNavigationGroups(visibleViews), [visibleViews]);
  const currentView = visibleViews.find((view) => view.id === activeView) || visibleViews[0] || CLIENT_PANEL_VIEW_COPY.overview;
  const validationErrors = useMemo(
    () => (draft ? extractBasicValidationErrors(buildValidationErrors(draft)) : {}),
    [draft],
  );
  const publicUrl = editor?.business?.publicUrl || (editor?.business?.slug ? `/site/${editor.business.slug}` : '');
  const publicCatalogUrl = editor?.business?.slug ? `/site/${editor.business.slug}/catalog` : '';
  const canSeeBasicsCard = Boolean(capabilities.canEditTenantBasics);
  const currentDomainStatus = getDomainStateForView(activeView, domainState);

  useEffect(() => {
    if (visibleViews.some((view) => view.id === activeView)) {
      return;
    }

    setActiveView(visibleViews[0]?.id || 'overview');
  }, [activeView, visibleViews]);

  useEffect(() => {
    if (!editor?.business?.id) {
      return;
    }

    if (['overview', 'settings'].includes(activeView)) {
      return;
    }

    void ensureViewData(activeView);
  }, [activeView, editor?.business?.id, ensureViewData]);

  useEffect(() => {
    if (!editor?.business?.id || loading) {
      return undefined;
    }

    const prefetchTarget = visibleViews.find((view) => view.id === 'orders') || visibleViews.find((view) => view.id === 'catalog');

    if (!prefetchTarget || prefetchTarget.id === activeView) {
      return undefined;
    }

    const runPrefetch = () => {
      void ensureViewData(prefetchTarget.id).catch(() => {});
    };

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(runPrefetch, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(runPrefetch, 900);
    return () => window.clearTimeout(timeoutId);
  }, [activeView, editor?.business?.id, ensureViewData, loading, visibleViews]);

  const handleCopyPublicUrl = useCallback(async () => {
    if (!publicUrl || !navigator?.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setMessage('Link publico copiado com sucesso.');
      setError('');
    } catch {
      setError('Nao foi possivel copiar o link publico.');
    }
  }, [publicUrl, setError, setMessage]);

  const handleSaveBasics = useCallback(async () => {
    if (!draft || !capabilities.canEditTenantBasics) {
      return;
    }

    if (Object.keys(validationErrors).length) {
      setError('Corrija os campos basicos destacados antes de salvar.');
      return;
    }

    setSavingBasics(true);
    setError('');

    try {
      await saveBasics(draft);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingBasics(false);
    }
  }, [capabilities.canEditTenantBasics, draft, saveBasics, setError, validationErrors]);

  if (isSuspendedClientAccess) {
    return (
      <AppShell
        eyebrow="TapLink Painel"
        title="Acesso temporariamente suspenso"
        description="Seu tenant continua vinculado ao painel, mas o acesso esta bloqueado ate a regularizacao com o suporte."
        shellClassName="dashboard-shell client-panel-shell"
        heroClassName="dashboard-shell__hero client-panel-shell__hero"
        contentClassName="dashboard-shell__content client-panel-shell__content"
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
      description="Bootstrap leve, cache por dominio e sincronizacao seletiva deixam o tenant mais rapido e conectado ao site publico."
      shellClassName="dashboard-shell client-panel-shell"
      heroClassName="dashboard-shell__hero client-panel-shell__hero"
      contentClassName="dashboard-shell__content client-panel-shell__content"
      pageTitle={`TapLink | ${editor?.business?.name || 'Painel do cliente'}`}
    >
      {message ? <p className="admin-status-banner admin-status-banner--success">{message}</p> : null}
      {error ? <p className="admin-status-banner admin-status-banner--error">{error}</p> : null}
      <BillingBanner billingStatus={access?.billingStatus} />

      {loading && !editor ? (
        <div className="client-panel-shell__layout">
          <Card className="admin-panel-card client-panel-sidebar client-panel-sidebar--loading">
            <div className="client-panel-sidebar__brand" />
            <div className="client-panel-sidebar__skeleton-list">
              <span />
              <span />
              <span />
              <span />
            </div>
          </Card>
          <div className="client-panel-shell__workspace">
            <ClientPanelSectionSkeleton title="Carregando painel do tenant" description="Buscando bootstrap, resumo do tenant e contexto seguro do usuario autenticado." />
          </div>
        </div>
      ) : editor && draft ? (
        <div className="client-panel-shell__layout">
          <aside className="admin-panel-card client-panel-sidebar">
            <div className="client-panel-sidebar__brand">
              <div className="client-panel-sidebar__brand-badge">{editor.business?.name?.slice(0, 2).toUpperCase() || 'TL'}</div>
              <div>
                <strong>{editor.business?.name || 'Tenant'}</strong>
                <span>{subscription?.plan?.name || subscription?.plan?.code || 'Plano'} • {BILLING_ACCESS_LABELS[access?.billingStatus] || access?.billingStatus || 'Pago'}</span>
              </div>
            </div>

            <nav aria-label="Navegacao do painel do cliente">
              {navigationGroups.map((group) => (
                <div key={group.id} className="client-panel-sidebar__group">
                  <span className="client-panel-sidebar__group-title">{group.label}</span>
                  <div className="client-panel-sidebar__nav">
                    {group.items.map((view) => (
                      <button
                        key={view.id}
                        type="button"
                        className={`client-panel-sidebar__nav-button${activeView === view.id ? ' is-active' : ''}`}
                        onClick={() => setActiveView(view.id)}
                      >
                        <span>{view.label}</span>
                        <small>{view.description}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="client-panel-sidebar__footer">
              <div>
                <strong>{ROLE_LEVEL_LABELS[user?.roleLevel] || `Nivel ${user?.roleLevel ?? '-'}`}</strong>
                <span>{ANALYTICS_SCOPE_LABELS[analyticsScope] || 'Sem analytics'}</span>
              </div>
              <div className="client-panel-sidebar__footer-actions">
                {publicUrl ? (
                  <Button variant="secondary" href={publicUrl} target="_blank" rel="noreferrer">
                    Abrir site
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={logout}>
                  Sair
                </Button>
              </div>
            </div>
          </aside>

          <div className="client-panel-shell__workspace">
            <div className="client-panel-mobile-nav" role="tablist" aria-label="Navegacao rapida do painel do cliente">
              {visibleViews.map((view) => (
                <button
                  key={`mobile-${view.id}`}
                  type="button"
                  className={`client-panel-mobile-nav__button${activeView === view.id ? ' is-active' : ''}`}
                  aria-selected={activeView === view.id}
                  onClick={() => setActiveView(view.id)}
                >
                  {view.label}
                </button>
              ))}
            </div>

            <section className="client-panel-page-header">
              <div className="client-panel-page-header__copy">
                <span className="section-eyebrow">{currentView.label}</span>
                <h2>{currentView.title}</h2>
                <p>{currentView.description}</p>
              </div>
              <div className="client-panel-page-header__meta">
                <div className="client-panel-chip-row client-panel-chip-row--header">
                  <span className="client-panel-chip">{subscription?.plan?.name || subscription?.plan?.code || 'Plano'}</span>
                  <span className="client-panel-chip client-panel-chip--muted">{BILLING_ACCESS_LABELS[access?.billingStatus] || access?.billingStatus || 'Pago'}</span>
                </div>
                <div className="client-panel-page-header__actions">
                  {activeView === 'settings' && canSeeBasicsCard ? (
                    <Button disabled={!capabilities.canEditTenantBasics || savingBasics} onClick={handleSaveBasics}>
                      {savingBasics ? 'Salvando...' : 'Salvar agora'}
                    </Button>
                  ) : null}
                  {activeView !== 'settings' && publicCatalogUrl && editor.business?.modules?.catalog ? (
                    <Button variant="secondary" href={publicCatalogUrl} target="_blank" rel="noreferrer">
                      Ver catalogo
                    </Button>
                  ) : null}
                  {publicUrl ? (
                    <Button variant="secondary" href={publicUrl} target="_blank" rel="noreferrer">
                      Abrir site
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={handleCopyPublicUrl} disabled={!publicUrl}>
                    Copiar link
                  </Button>
                </div>
              </div>
            </section>

            {activeView === 'overview' ? (
              <ClientPanelOverview
                editor={editor}
                subscription={subscription}
                access={access}
                user={user}
                onNavigate={setActiveView}
                onCopyPublicUrl={handleCopyPublicUrl}
                publicUrl={publicUrl}
              />
            ) : null}

            {activeView === 'settings' && canSeeBasicsCard ? (
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

            {['catalog', 'stock', 'orders', 'appointments', 'professionals', 'services'].includes(activeView) ? (
              currentDomainStatus?.status === 'ready' ? (
                <section className="client-panel-workspace client-panel-domain-surface">
                  <TenantModuleManagementSection
                    draft={draft}
                    onDraftChange={setDraft}
                    moduleActions={moduleActions}
                    busyKey={moduleBusyKey}
                    onUpload={handleUpload}
                    mode="client"
                    permissions={capabilities}
                    activeTab={activeView}
                    onActiveTabChange={setActiveView}
                    showTabs={false}
                  />
                </section>
              ) : (
                <ClientPanelSectionSkeleton title={currentView.title} description={currentView.description} />
              )
            ) : null}

            {activeView === 'analytics' ? (
              <ClientAnalyticsPanel
                analytics={analytics}
                analyticsLoading={analyticsLoading}
                analyticsError={analyticsError}
                scope={analytics?.scope || analyticsScope}
                planCode={planCode}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState title="Nao foi possivel abrir o tenant" description="Recarregue a pagina ou entre em contato com o suporte se o problema persistir." />
      )}
    </AppShell>
  );
}
