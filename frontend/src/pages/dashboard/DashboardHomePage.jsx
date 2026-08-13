import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { subscribeToTenantUpdates } from '@/services/tenantRealtimeService.js';
import { slugify } from '@shared/utils/tenantIdentity.js';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { AppShell } from '@/components/layout/AppShell.jsx';
import { TenantEditorPanel } from '@/components/business/TenantEditorPanel.jsx';
import { TenantListPanel } from '@/components/business/TenantListPanel.jsx';
import { TenantOnboardingForm } from '@/components/business/TenantOnboardingForm.jsx';
import { TenantPreviewPanel } from '@/components/business/TenantPreviewPanel.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue.js';
import {
  createAdminPreviewToken,
  createTenantAppointmentService,
  createAdminBusiness,
  createTenantProduct,
  createTenantProfessional,
  deleteTenantAppointmentService,
  deleteAdminBusiness,
  deleteTenantProduct,
  deleteTenantProfessional,
  fetchAdminOverview,
  getAdminBusiness,
  listAdminBusinesses,
  resetAdminAnalytics,
  updateTenantAppointmentRequestStatus,
  updateTenantAppointmentService,
  updateAdminBusiness,
  updateAdminBusinessStatus,
  updateTenantOrderStatus,
  updateTenantOrderPaymentStatus,
  updateTenantProduct,
  updateTenantProfessional,
  uploadAdminImage,
} from '@/services/adminService.js';

const LazyAdminAnalyticsView = lazy(() =>
  import('@/components/business/AdminAnalyticsView.jsx').then((module) => ({
    default: module.AdminAnalyticsView,
  })),
);

const LazyAdminClientsPanel = lazy(() =>
  import('@/components/business/AdminClientsPanel.jsx').then((module) => ({
    default: module.AdminClientsPanel,
  })),
);

const LazyAdminFinancialSettingsPanel = lazy(() =>
  import('@/components/business/AdminFinancialSettingsPanel.jsx').then((module) => ({
    default: module.AdminFinancialSettingsPanel,
  })),
);

function cloneTenantSnapshot(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function buildUniqueSuffix(baseValue, existingValues = [], formatter) {
  const existing = new Set(existingValues.filter(Boolean).map((item) => String(item).trim().toLowerCase()));
  let attempt = 1;
  let candidate = formatter(baseValue, attempt);

  while (existing.has(candidate.trim().toLowerCase())) {
    attempt += 1;
    candidate = formatter(baseValue, attempt);
  }

  return candidate;
}

function buildDuplicatePayload(editor, businesses = []) {
  const sourceEditor = cloneTenantSnapshot(editor) || {};
  const sourceBusiness = sourceEditor.business || {};
  const nextName = buildUniqueSuffix(sourceBusiness.name || 'Novo tenant', businesses.map((business) => business.name), (value, attempt) =>
    attempt === 1 ? `${value} (copy)` : `${value} (copy ${attempt})`,
  );
  const nextSlug = buildUniqueSuffix(sourceBusiness.slug || slugify(nextName), businesses.map((business) => business.slug), (value, attempt) => {
    const base = slugify(`${value}-copy`);
    return attempt === 1 ? base : `${base}-${attempt}`;
  });

  const {
    id: _businessId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    history: _history,
    analytics: _analytics,
    publicUrl: _publicUrl,
    ...businessForClone
  } = sourceBusiness;

  return {
    business: {
      ...businessForClone,
      name: nextName,
      slug: nextSlug,
      domains: {
        ...(businessForClone.domains || {}),
        subdomain: '',
        customDomain: '',
        customDomainVerifiedAt: undefined,
      },
    },
    theme: sourceEditor.theme || {},
    links: sourceEditor.links || [],
    sections: sourceEditor.sections || [],
    nfcTag: sourceEditor.nfcTag ? { status: sourceEditor.nfcTag.status || 'active', code: '' } : null,
  };
}

function formatValidationDetails(details = []) {
  return details
    .filter((detail) => detail?.message)
    .map((detail) => (detail.path ? `${detail.path}: ${detail.message}` : detail.message))
    .join(' | ');
}

function getErrorMessage(error) {
  if (Array.isArray(error?.details) && error.details.length) {
    return formatValidationDetails(error.details);
  }

  return error?.message || 'Nao foi possivel concluir esta operacao.';
}

function buildBusinessSummaryFromEditor(editor, fallbackSummary = null) {
  const business = editor?.business;

  if (!business?.id) {
    return fallbackSummary;
  }

  return {
    ...(fallbackSummary || {}),
    id: business.id,
    name: business.name || fallbackSummary?.name || '',
    slug: business.slug || fallbackSummary?.slug || '',
    status: business.status || fallbackSummary?.status || 'draft',
    publicUrl: business.publicUrl || fallbackSummary?.publicUrl || '',
    segment: business.segment || fallbackSummary?.segment || 'other',
    modules: business.modules || fallbackSummary?.modules || {},
    logoUrl: business.logoUrl || fallbackSummary?.logoUrl || '',
    domains: business.domains || fallbackSummary?.domains || {},
    description: business.description || fallbackSummary?.description || '',
    createdAt: business.createdAt || fallbackSummary?.createdAt || null,
    updatedAt: business.updatedAt || fallbackSummary?.updatedAt || null,
    analytics: {
      ...(fallbackSummary?.analytics || {}),
      totalEvents: editor?.analytics?.totalEvents ?? fallbackSummary?.analytics?.totalEvents ?? 0,
      pageViews: editor?.analytics?.pageViews ?? fallbackSummary?.analytics?.pageViews ?? 0,
      linkClicks: editor?.analytics?.linkClicks ?? fallbackSummary?.analytics?.linkClicks ?? 0,
      lastEventAt:
        editor?.analytics?.recentEvents?.[0]?.occurredAt ??
        fallbackSummary?.analytics?.lastEventAt ??
        null,
    },
  };
}

function mergeEditorIntoBusinessSummaries(currentBusinesses = [], editor) {
  const editorBusinessId = String(editor?.business?.id || '').trim();

  if (!editorBusinessId) {
    return currentBusinesses;
  }

  const existingSummary = currentBusinesses.find((business) => business.id === editorBusinessId) || null;
  const nextSummary = buildBusinessSummaryFromEditor(editor, existingSummary);

  if (!nextSummary) {
    return currentBusinesses;
  }

  if (!existingSummary) {
    return [nextSummary, ...currentBusinesses];
  }

  return currentBusinesses.map((business) => (business.id === editorBusinessId ? nextSummary : business));
}

function DashboardViewFallback({ title, description }) {
  return (
    <Card className="admin-panel-card">
      <p className="admin-muted-copy" role="status" aria-live="polite">
        <strong>{title}</strong>
      </p>
      <p className="admin-muted-copy">{description}</p>
    </Card>
  );
}

function formatMetricValue(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

const ADMIN_VIEW_COPY = Object.freeze({
  dashboard: {
    icon: 'dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    description: 'Resumo operacional para encontrar rapidamente tenants, clientes e pendencias.',
  },
  workspace: {
    icon: 'tenants',
    label: 'Tenants',
    title: 'Tenants',
    description: 'Crie, edite, duplique e publique tenants sem perder o contexto da operacao.',
  },
  analytics: {
    icon: 'analytics',
    label: 'Analises',
    title: 'Analises',
    description: 'Acompanhe uso, baseline e desempenho dos sites publicos.',
  },
  clients: {
    icon: 'clients',
    label: 'Clientes',
    title: 'Clientes',
    description: 'Gerencie acessos, vinculos, niveis, planos e status financeiros.',
  },
  finance: {
    icon: 'finance',
    label: 'Financeiro',
    title: 'Financeiro',
    description: 'Configure Asaas, split, checkout e credenciais financeiras da plataforma.',
  },
});

const ADMIN_NAV_GROUPS = [
  { id: 'overview', label: 'Visao geral', views: ['dashboard'] },
  { id: 'management', label: 'Gestao', views: ['workspace', 'clients'] },
  { id: 'intelligence', label: 'Inteligencia', views: ['analytics'] },
  { id: 'finance', label: 'Financeiro', views: ['finance'] },
];

function buildAdminNavigationGroups(canManageBilling = false) {
  const allowedViews = Object.entries(ADMIN_VIEW_COPY)
    .filter(([viewId]) => viewId !== 'finance' || canManageBilling)
    .map(([id, view]) => ({ id, ...view }));
  const viewMap = new Map(allowedViews.map((view) => [view.id, view]));

  return ADMIN_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.views.map((viewId) => viewMap.get(viewId)).filter(Boolean),
    }))
    .filter((group) => group.items.length);
}

function AdminNavIcon({ icon }) {
  const sharedProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  switch (icon) {
    case 'tenants':
      return (
        <svg {...sharedProps}>
          <path d="M4 7h16" />
          <path d="M6 7v12" />
          <path d="M18 7v12" />
          <path d="M4 19h16" />
        </svg>
      );
    case 'clients':
      return (
        <svg {...sharedProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.8 19c1.4-3.2 3.1-4.8 5.2-4.8s3.8 1.6 5.2 4.8" />
          <circle cx="17" cy="9" r="2.4" />
          <path d="M14.8 15.2c1.5.4 2.8 1.6 3.7 3.8" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...sharedProps}>
          <path d="M5 18V9" />
          <path d="M12 18V5" />
          <path d="M19 18v-7" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...sharedProps}>
          <path d="M4 7h16v10H4z" />
          <path d="M8 11h.01" />
          <path d="M12 11h4" />
        </svg>
      );
    case 'dashboard':
    default:
      return (
        <svg {...sharedProps}>
          <path d="M4 13h7V4H4z" />
          <path d="M13 20h7v-7h-7z" />
          <path d="M13 11h7V4h-7z" />
          <path d="M4 20h7v-5H4z" />
        </svg>
      );
  }
}

function AdminSidebar({
  navigationGroups,
  activeView,
  onViewChange,
  user,
  selectedSummary,
  overview,
  loading,
  onRefresh,
  onLogout,
}) {
  return (
    <aside className="admin-modern-sidebar client-panel-sidebar">
      <div className="client-panel-sidebar__brand">
        <div className="client-panel-sidebar__brand-badge">TA</div>
        <div>
          <strong>TapLink Admin</strong>
          <span>{user?.displayName || 'Operacao'}</span>
        </div>
      </div>

      <nav className="client-panel-sidebar__navigation" aria-label="Navegacao do painel administrativo">
        {navigationGroups.map((group) => (
          <div key={group.id} className="client-panel-sidebar__group">
            <span className="client-panel-sidebar__group-title">{group.label}</span>
            <div className="client-panel-sidebar__nav">
              {group.items.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={`client-panel-sidebar__nav-button${activeView === view.id ? ' is-active' : ''}`}
                  onClick={() => onViewChange(view.id)}
                >
                  <span className="client-panel-sidebar__nav-icon">
                    <AdminNavIcon icon={view.icon} />
                  </span>
                  <span className="client-panel-sidebar__nav-label">{view.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="client-panel-sidebar__footer">
        <div className="client-panel-sidebar__plan admin-modern-sidebar__tenant">
          <span>Tenant em foco</span>
          <strong>{selectedSummary?.name || 'Nenhum tenant'}</strong>
          <small>{selectedSummary ? `/site/${selectedSummary.slug}` : 'Selecione um tenant para editar.'}</small>
        </div>
        <div className="admin-modern-sidebar__stats">
          <span>{formatMetricValue(overview?.totals?.activeBusinesses)} ativos</span>
          <span>{formatMetricValue(overview?.totals?.inactiveBusinesses)} inativos</span>
        </div>
        <div className="client-panel-sidebar__footer-actions">
          <Button variant="ghost" className="client-panel-sidebar__logout" onClick={onRefresh} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar dados'}
          </Button>
          <Button variant="ghost" className="client-panel-sidebar__logout" onClick={onLogout}>
            Sair
          </Button>
        </div>
      </div>
    </aside>
  );
}

function AdminMobileNav({ navigationGroups, activeView, onViewChange }) {
  const [shouldRenderMobileNav, setShouldRenderMobileNav] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(max-width: 920px)').matches;
  });
  const views = navigationGroups.flatMap((group) => group.items);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 920px)');
    const syncMobileNav = () => setShouldRenderMobileNav(mediaQuery.matches);

    syncMobileNav();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMobileNav);
      return () => mediaQuery.removeEventListener('change', syncMobileNav);
    }

    mediaQuery.addListener(syncMobileNav);
    return () => mediaQuery.removeListener(syncMobileNav);
  }, []);

  if (!shouldRenderMobileNav) {
    return null;
  }

  return (
    <div className="client-panel-mobile-nav admin-modern-mobile-nav" role="tablist" aria-label="Navegacao rapida do painel administrativo">
      {views.map((view) => (
        <button
          key={`mobile-${view.id}`}
          type="button"
          className={`client-panel-mobile-nav__button${activeView === view.id ? ' is-active' : ''}`}
          aria-selected={activeView === view.id}
          onClick={() => onViewChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

function AdminPageHeader({
  currentView,
  activeView,
  selectedSummary,
  loading,
  onRefresh,
  onCopyPublicLink,
  onOpenWorkspace,
}) {
  return (
    <section className="client-panel-page-header admin-modern-page-header">
      <div className="client-panel-page-header__copy">
        <h2>{currentView.title}</h2>
        <p>{currentView.description}</p>
        {activeView === 'workspace' ? <span className="admin-visually-hidden">Workspace da operacao</span> : null}
      </div>
      <div className="client-panel-page-header__actions">
        {activeView === 'dashboard' ? (
          <Button variant="secondary" onClick={onOpenWorkspace}>
            Abrir tenants
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar'}
        </Button>
        {activeView === 'workspace' && selectedSummary ? (
          <>
            <Button href={selectedSummary.publicUrl || `/site/${selectedSummary.slug}`} target="_blank" rel="noreferrer">
              Abrir pagina publica
            </Button>
            <Button variant="ghost" onClick={onCopyPublicLink}>
              Copiar link
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function AdminOperationsDashboard({ overview, businesses = [], selectedSummary, onNavigate, onSelectBusiness }) {
  const analyticsHighlights = overview?.analytics?.highlights || {};
  const attentionTenants = businesses
    .filter((business) => business.status !== 'active' || !Object.values(business.modules || {}).some(Boolean))
    .slice(0, 6);
  const recentEvents = overview?.recentEvents || overview?.analytics?.recentEvents || [];

  return (
    <div className="admin-operations-dashboard">
      <div className="client-panel-kpi-grid admin-operations-dashboard__kpis">
        <div className="client-panel-kpi client-panel-kpi--info">
          <span>Tenants ativos</span>
          <strong>{formatMetricValue(overview?.totals?.activeBusinesses)}</strong>
          <small>Sites liberados para o publico.</small>
        </div>
        <div className="client-panel-kpi client-panel-kpi--warning">
          <span>Tenants em atencao</span>
          <strong>{formatMetricValue((overview?.totals?.inactiveBusinesses || 0) + (overview?.totals?.draftBusinesses || 0))}</strong>
          <small>Inativos, drafts ou sem publicacao final.</small>
        </div>
        <div className="client-panel-kpi client-panel-kpi--accent">
          <span>Eventos totais</span>
          <strong>{formatMetricValue(analyticsHighlights.totalEvents || overview?.totals?.totalEvents)}</strong>
          <small>Visitas e interacoes no baseline atual.</small>
        </div>
        <div className="client-panel-kpi client-panel-kpi--danger">
          <span>Ultimos 7 dias</span>
          <strong>{formatMetricValue(analyticsHighlights.last7DaysEvents || overview?.totals?.last7DaysEvents)}</strong>
          <small>Ritmo recente da operacao.</small>
        </div>
      </div>

      <div className="client-panel-overview-grid admin-operations-dashboard__grid">
        <section className="client-panel-overview-main">
          <div className="client-panel-section-heading">
            <div>
              <h3>Tenants que pedem atencao</h3>
              <p>Priorize status, modulos vazios e configuracoes incompletas.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onNavigate('workspace')}>
              Ver tenants
            </Button>
          </div>

          {attentionTenants.length ? (
            <div className="admin-tenant-attention-list">
              {attentionTenants.map((business) => (
                <button
                  key={business.id}
                  type="button"
                  className="client-panel-order-row admin-tenant-attention-row"
                  onClick={() => {
                    onSelectBusiness?.(business.id);
                    onNavigate('workspace');
                  }}
                >
                  <span className="client-panel-order-row__id">{business.status || 'draft'}</span>
                  <span className="client-panel-order-row__name">{business.name}</span>
                  <span className="client-panel-order-row__value">/{business.slug}</span>
                  <span className="client-panel-order-row__time">{business.segment || 'other'}</span>
                  <span className={`tenant-list__status tenant-list__status--${business.status || 'draft'}`}>{business.status || 'draft'}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="client-panel-empty-note">
              <strong>Nenhum tenant critico agora.</strong>
              <span>Tenants inativos, drafts ou sem modulos ativos aparecem aqui.</span>
            </div>
          )}
        </section>

        <aside className="client-panel-overview-side">
          <section className="client-panel-side-section">
            <div className="client-panel-section-heading">
              <h3>Acoes rapidas</h3>
            </div>
            <div className="client-panel-action-list">
              <button type="button" className="client-panel-action-link" onClick={() => onNavigate('workspace')}>
                <span>Editar tenant em foco</span>
                <small>{selectedSummary?.name || 'Abrir'}</small>
              </button>
              <button type="button" className="client-panel-action-link" onClick={() => onNavigate('clients')}>
                <span>Gerenciar clientes</span>
                <small>Acessos</small>
              </button>
              <button type="button" className="client-panel-action-link" onClick={() => onNavigate('analytics')}>
                <span>Ver analytics</span>
                <small>Baseline</small>
              </button>
            </div>
          </section>

          <section className="client-panel-side-section">
            <div className="client-panel-section-heading">
              <h3>Atividade recente</h3>
            </div>
            {recentEvents.length ? (
              <div className="admin-event-list admin-event-list--scroll admin-operations-dashboard__events">
                {recentEvents.slice(0, 5).map((event) => (
                  <div key={event.id || `${event.eventType}-${event.occurredAt}`} className="admin-event-item admin-event-item--analytics">
                    <div>
                      <strong>{event.businessName || 'Tenant'}</strong>
                      <span>{event.targetLabel || event.eventType || 'Evento'}</span>
                    </div>
                    <time dateTime={event.occurredAt}>{event.occurredAt ? new Date(event.occurredAt).toLocaleString('pt-BR') : ''}</time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="client-panel-empty-note client-panel-empty-note--inline">
                <strong>Sem eventos recentes.</strong>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export function DashboardHomePage() {
  const { token, user, access, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [editor, setEditor] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [moduleBusyKey, setModuleBusyKey] = useState('');
  const [resettingAnalytics, setResettingAnalytics] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tenantSearchInput, setTenantSearchInput] = useState('');
  const [tenantSort, setTenantSort] = useState('newest');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('all');
  const [previewRefreshKey, setPreviewRefreshKey] = useState(() => Date.now());
  const [previewToken, setPreviewToken] = useState('');
  const [activeView, setActiveView] = useState('workspace');
  const debouncedTenantSearch = useDebouncedValue(tenantSearchInput, 300);

  const refreshPreview = useCallback(
    async (targetBusinessId = selectedBusinessId) => {
      if (!token || !targetBusinessId) {
        setPreviewToken('');
        setPreviewRefreshKey((current) => Math.max(Date.now(), current + 1));
        return;
      }

      try {
        const previewAccess = await createAdminPreviewToken(token, targetBusinessId);
        setPreviewToken(String(previewAccess?.token || ''));
        setPreviewRefreshKey((current) => Math.max(Date.now(), current + 1));
      } catch (previewError) {
        setPreviewToken('');
        setError(getErrorMessage(previewError));
      }
    },
    [selectedBusinessId, token],
  );

  const applyEditorSnapshot = useCallback((nextEditor) => {
    if (!nextEditor?.business?.id) {
      setEditor(nextEditor);
      return nextEditor;
    }

    setSelectedBusinessId(nextEditor.business.id);
    setEditor(nextEditor);
    setBusinesses((current) => mergeEditorIntoBusinessSummaries(current, nextEditor));
    return nextEditor;
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapDashboard() {
      if (!token) {
        return;
      }

      setLoadingWorkspace(true);
      setError('');

      try {
        const [nextOverview, nextBusinesses] = await Promise.all([
          fetchAdminOverview(token),
          listAdminBusinesses(token),
        ]);

        if (!active) {
          return;
        }

        setOverview(nextOverview);
        setBusinesses(nextBusinesses);
        setSelectedBusinessId((current) => {
          if (current && nextBusinesses.some((business) => business.id === current)) {
            return current;
          }

          return nextBusinesses[0]?.id || '';
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (active) {
          setLoadingWorkspace(false);
        }
      }
    }

    bootstrapDashboard();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;

    async function loadEditor() {
      if (!token || !selectedBusinessId) {
        setEditor(null);
        return;
      }

      setLoadingEditor(true);
      setError('');

      try {
        const nextEditor = await getAdminBusiness(token, selectedBusinessId);

        if (!active) {
          return;
        }

        applyEditorSnapshot(nextEditor);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (active) {
          setLoadingEditor(false);
        }
      }
    }

    loadEditor();

    return () => {
      active = false;
    };
  }, [applyEditorSnapshot, selectedBusinessId, token]);

  useEffect(() => {
    if (!selectedBusinessId || !token) {
      setPreviewToken('');
      return;
    }

    let active = true;

    Promise.resolve()
      .then(() => createAdminPreviewToken(token, selectedBusinessId))
      .then((previewAccess) => {
        if (!active) {
          return;
        }

        setPreviewToken(String(previewAccess?.token || ''));
        setPreviewRefreshKey((current) => Math.max(Date.now(), current + 1));
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setPreviewToken('');
      });

    return () => {
      active = false;
    };
  }, [selectedBusinessId, token]);

  const refreshCollections = useCallback(async (preferredBusinessId = '', preferredEditor = null) => {
    const [nextOverview, nextBusinesses] = await Promise.all([
      fetchAdminOverview(token),
      listAdminBusinesses(token),
    ]);
    const synchronizedBusinesses = preferredEditor
      ? mergeEditorIntoBusinessSummaries(nextBusinesses, preferredEditor)
      : nextBusinesses;

    setOverview(nextOverview);
    setBusinesses(synchronizedBusinesses);
    setSelectedBusinessId((current) => {
      if (preferredBusinessId) {
        return preferredBusinessId;
      }

      const candidate = current;

      if (candidate && synchronizedBusinesses.some((business) => business.id === candidate)) {
        return candidate;
      }

      return synchronizedBusinesses[0]?.id || '';
    });
  }, [token]);

  const refreshEditorSnapshot = useCallback(async (targetBusinessId = selectedBusinessId) => {
    if (!token || !targetBusinessId) {
      return null;
    }

    const nextEditor = await getAdminBusiness(token, targetBusinessId);
    applyEditorSnapshot(nextEditor);
    return nextEditor;
  }, [applyEditorSnapshot, selectedBusinessId, token]);

  useEffect(() => {
    if (!token || !selectedBusinessId) {
      return undefined;
    }

    let active = true;

    const unsubscribe = subscribeToTenantUpdates(
      { businessId: selectedBusinessId },
      {
        async onTenantUpdated() {
          if (!active) {
            return;
          }

          try {
            await Promise.all([
              refreshCollections(selectedBusinessId),
              refreshEditorSnapshot(selectedBusinessId),
            ]);

            if (!active) {
              return;
            }

            refreshPreview();
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
  }, [refreshCollections, refreshEditorSnapshot, refreshPreview, selectedBusinessId, token]);

  async function handleCreate(payload) {
    setCreating(true);
    setMessage('');
    setError('');

    try {
      const createdEditor = await createAdminBusiness(token, payload);
      applyEditorSnapshot(createdEditor);
      await refreshCollections(createdEditor.business.id, createdEditor);
      refreshPreview();
      setMessage('Tenant criado com sucesso. Agora voce pode completar o conteudo no editor.');
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(draft) {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const updatedEditor = await updateAdminBusiness(token, draft.business.id, draft);
      applyEditorSnapshot(updatedEditor);
      await refreshCollections(updatedEditor.business.id, updatedEditor);
      refreshPreview();
      setMessage('Alteracoes salvas e analytics atualizados.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(businessId) {
    if (!window.confirm('Deseja mesmo excluir este tenant? Esta acao remove conteudo, links e analytics relacionados.')) {
      return;
    }

    setDeleting(true);
    setMessage('');
    setError('');

    try {
      await deleteAdminBusiness(token, businessId);
      setEditor(null);
      await refreshCollections('');
      refreshPreview();
      setMessage('Tenant removido com sucesso.');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleStatus(businessId, nextStatus) {
    setTogglingStatus(true);
    setMessage('');
    setError('');

    try {
      const updatedEditor = await updateAdminBusinessStatus(token, businessId, nextStatus);
      applyEditorSnapshot(updatedEditor);
      await refreshCollections(updatedEditor.business.id, updatedEditor);
      refreshPreview();
      setMessage(
        nextStatus === 'active'
          ? 'Site ativado com sucesso. A pagina publica voltou a ficar disponivel.'
          : 'Site inativado com sucesso. O publico agora ve uma mensagem neutra de indisponibilidade.',
      );
    } catch (statusError) {
      setError(getErrorMessage(statusError));
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleUpload(file, options = {}) {
    setMessage('');
    setError('');

    try {
      const result = await uploadAdminImage(token, file, options);
      setMessage('Upload concluido. O editor ja pode usar a nova imagem.');
      return result;
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
      throw uploadError;
    }
  }

  async function handleDuplicate() {
    if (!editor) {
      return;
    }

    setDuplicating(true);
    setMessage('');
    setError('');

    try {
      const duplicatedEditor = await createAdminBusiness(token, buildDuplicatePayload(editor, businesses));
      applyEditorSnapshot(duplicatedEditor);
      await refreshCollections(duplicatedEditor.business.id, duplicatedEditor);
      refreshPreview();
      setMessage('Tenant duplicado com sucesso. O codigo NFC foi limpo para evitar conflito no clone.');
    } catch (duplicateError) {
      setError(getErrorMessage(duplicateError));
    } finally {
      setDuplicating(false);
    }
  }

  async function runModuleAction(busyKey, action, successMessage) {
    if (!selectedBusinessId) {
      return;
    }

    setModuleBusyKey(busyKey);
    setMessage('');
    setError('');

    try {
      await action();
      await refreshEditorSnapshot(selectedBusinessId);
      refreshPreview();
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (moduleError) {
      setError(getErrorMessage(moduleError));
    } finally {
      setModuleBusyKey('');
    }
  }

  const moduleActions = useMemo(
    () => ({
      createProfessional: (payload) =>
        runModuleAction('create-professional', () => createTenantProfessional(token, selectedBusinessId, payload), 'Profissional salvo com sucesso.'),
      updateProfessional: (professionalId, payload) =>
        runModuleAction('update-professional', () => updateTenantProfessional(token, selectedBusinessId, professionalId, payload), 'Profissional atualizado com sucesso.'),
      deleteProfessional: (professionalId) =>
        runModuleAction('delete-professional', () => deleteTenantProfessional(token, selectedBusinessId, professionalId), 'Profissional removido com sucesso.'),
      createAppointmentService: (payload) =>
        runModuleAction('create-appointment-service', () => createTenantAppointmentService(token, selectedBusinessId, payload), 'Servico de agendamento salvo com sucesso.'),
      updateAppointmentService: (serviceId, payload) =>
        runModuleAction('update-appointment-service', () => updateTenantAppointmentService(token, selectedBusinessId, serviceId, payload), 'Servico de agendamento atualizado com sucesso.'),
      deleteAppointmentService: (serviceId) =>
        runModuleAction('delete-appointment-service', () => deleteTenantAppointmentService(token, selectedBusinessId, serviceId), 'Servico de agendamento removido com sucesso.'),
      createProduct: (payload) =>
        runModuleAction('create-product', () => createTenantProduct(token, selectedBusinessId, payload), 'Produto salvo com sucesso.'),
      updateProduct: (productId, payload) =>
        runModuleAction('update-product', () => updateTenantProduct(token, selectedBusinessId, productId, payload), 'Produto atualizado com sucesso.'),
      deleteProduct: (productId) =>
        runModuleAction('delete-product', () => deleteTenantProduct(token, selectedBusinessId, productId), 'Produto removido com sucesso.'),
      updateAppointmentRequestStatus: (requestId, status) =>
        runModuleAction('update-appointment-request-status', () => updateTenantAppointmentRequestStatus(token, selectedBusinessId, requestId, status), 'Status do agendamento atualizado com sucesso.'),
      updateOrderStatus: (orderId, status) =>
        runModuleAction('update-order-status', () => updateTenantOrderStatus(token, selectedBusinessId, orderId, status), 'Status do pedido atualizado com sucesso.'),
      updateOrderPaymentStatus: (orderId, status) =>
        runModuleAction('update-order-payment-status', () => updateTenantOrderPaymentStatus(token, selectedBusinessId, orderId, status), 'Status do pagamento atualizado com sucesso.'),
    }),
    [refreshPreview, selectedBusinessId, token],
  );

  async function handleCopyPublicLink() {
    const urlToCopy = editor?.business?.publicUrl || selectedSummary?.publicUrl;

    if (!urlToCopy) {
      setError('Nao foi possivel gerar o link publico deste tenant.');
      return;
    }

    try {
      await navigator.clipboard.writeText(urlToCopy);
      setMessage('Link publico copiado!');
    } catch {
      setError('Nao foi possivel copiar o link publico.');
    }
  }

  async function handleResetAnalytics() {
    if (!token || !access?.capabilities?.canManageBilling) {
      return;
    }

    if (!window.confirm('Deseja resetar o baseline global de analytics a partir de agora? Os eventos antigos serao preservados, mas os dashboards passarao a considerar apenas dados novos.')) {
      return;
    }

    setResettingAnalytics(true);
    setMessage('');
    setError('');

    try {
      const result = await resetAdminAnalytics(token);
      await Promise.all([
        refreshCollections(selectedBusinessId),
        refreshEditorSnapshot(selectedBusinessId),
      ]);
      setMessage(`Analytics resetado com sucesso. Novo baseline global: ${new Date(result.baselineAt).toLocaleString('pt-BR')}.`);
    } catch (resetError) {
      setError(getErrorMessage(resetError));
    } finally {
      setResettingAnalytics(false);
    }
  }

  const filteredBusinesses = useMemo(() => {
    const searchTerm = debouncedTenantSearch.trim().toLowerCase();
    const nextBusinesses = businesses.filter((business) => {
      const matchesFilter = tenantStatusFilter === 'all' ? true : business.status === tenantStatusFilter;
      const matchesSearch =
        !searchTerm ||
        business.name.toLowerCase().includes(searchTerm) ||
        business.slug.toLowerCase().includes(searchTerm);

      return matchesFilter && matchesSearch;
    });

    return nextBusinesses.sort((first, second) => {
      if (tenantSort === 'alphabetical') {
        return first.name.localeCompare(second.name, 'pt-BR');
      }

      if (tenantSort === 'active') {
        if (first.status === second.status) {
          return first.name.localeCompare(second.name, 'pt-BR');
        }

        if (first.status === 'active') {
          return -1;
        }

        if (second.status === 'active') {
          return 1;
        }

        return first.name.localeCompare(second.name, 'pt-BR');
      }

      return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
    });
  }, [businesses, debouncedTenantSearch, tenantSort, tenantStatusFilter]);

  const selectedSummary = useMemo(() => {
    const currentSummary = businesses.find((business) => business.id === selectedBusinessId) || null;

    if (!editor?.business?.id || editor.business.id !== selectedBusinessId) {
      return currentSummary;
    }

    return buildBusinessSummaryFromEditor(editor, currentSummary);
  }, [businesses, editor, selectedBusinessId]);
  const previewUrl =
    selectedSummary?.slug && previewToken && typeof window !== 'undefined'
      ? `${window.location.origin}/site/${selectedSummary.slug}?preview=1&t=${previewRefreshKey}&previewToken=${encodeURIComponent(previewToken)}`
      : selectedSummary?.slug
        ? ''
        : selectedSummary?.publicUrl || '';
  const canManageBilling = Boolean(access?.capabilities?.canManageBilling);
  const navigationGroups = useMemo(() => buildAdminNavigationGroups(canManageBilling), [canManageBilling]);
  const currentView = ADMIN_VIEW_COPY[activeView] || ADMIN_VIEW_COPY.workspace;

  return (
    <AppShell
      shellClassName="dashboard-shell admin-modern-shell"
      contentClassName="dashboard-shell__content admin-modern-shell__content"
      pageTitle="TapLink | Dashboard"
      headerVariant="none"
    >
      <div className="admin-modern-layout">
        <AdminSidebar
          navigationGroups={navigationGroups}
          activeView={activeView}
          onViewChange={setActiveView}
          user={user}
          selectedSummary={selectedSummary}
          overview={overview}
          loading={loadingWorkspace}
          onRefresh={() => refreshCollections(selectedBusinessId)}
          onLogout={logout}
        />

        <div className="admin-modern-workspace">
          <AdminMobileNav navigationGroups={navigationGroups} activeView={activeView} onViewChange={setActiveView} />

          <AdminPageHeader
            currentView={currentView}
            activeView={activeView}
            selectedSummary={selectedSummary}
            loading={loadingWorkspace}
            onRefresh={() => refreshCollections(selectedBusinessId)}
            onCopyPublicLink={handleCopyPublicLink}
            onOpenWorkspace={() => setActiveView('workspace')}
          />

          {message ? <p className="admin-status-banner admin-status-banner--success">{message}</p> : null}
          {error ? <p className="admin-status-banner admin-status-banner--error">{error}</p> : null}

          {loadingWorkspace && !overview ? (
            <EmptyState title="Carregando dashboard" description="Buscando tenants, analytics e configuracoes da operacao." />
          ) : activeView === 'dashboard' ? (
            <AdminOperationsDashboard
              overview={overview}
              businesses={businesses}
              selectedSummary={selectedSummary}
              onNavigate={setActiveView}
              onSelectBusiness={setSelectedBusinessId}
            />
          ) : activeView === 'workspace' ? (
            <div className="admin-workspace admin-workspace--redesigned">
              <div className="admin-sidebar-stack">
                <TenantOnboardingForm creating={creating} onCreate={handleCreate} />
                <TenantListPanel
                  businesses={filteredBusinesses}
                  selectedBusinessId={selectedBusinessId}
                  loading={loadingWorkspace}
                  onSelect={setSelectedBusinessId}
                  searchValue={tenantSearchInput}
                  onSearchChange={setTenantSearchInput}
                  sortValue={tenantSort}
                  onSortChange={setTenantSort}
                  statusFilter={tenantStatusFilter}
                  onStatusFilterChange={setTenantStatusFilter}
                />
              </div>

              <div className="admin-editor-column">
                <div className="admin-editor-layout">
                  <div className="admin-editor-pane">
                    {loadingEditor ? (
                      <Card className="admin-panel-card">
                        <p className="admin-muted-copy">Carregando editor do tenant...</p>
                      </Card>
                    ) : (
                      <TenantEditorPanel
                        editor={editor}
                        saving={saving}
                        togglingStatus={togglingStatus}
                        deleting={deleting}
                        duplicating={duplicating}
                        onSave={handleSave}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                        onUpload={handleUpload}
                        onDuplicate={handleDuplicate}
                        onCopyPublicLink={handleCopyPublicLink}
                        moduleActions={moduleActions}
                        moduleBusyKey={moduleBusyKey}
                      />
                    )}
                  </div>

                  <TenantPreviewPanel
                    previewUrl={previewUrl}
                    publicUrl={selectedSummary?.publicUrl || ''}
                    businessName={selectedSummary?.name || ''}
                    status={selectedSummary?.status || ''}
                    previewKey={previewRefreshKey}
                    onRefresh={refreshPreview}
                  />
                </div>
              </div>
            </div>
          ) : activeView === 'analytics' ? (
            <Suspense
              fallback={
                <DashboardViewFallback
                  title="Carregando analises"
                  description="Preparando os graficos e consolidando os dados do tenant selecionado."
                />
              }
            >
              <LazyAdminAnalyticsView
                overview={overview}
                editor={editor}
                selectedSummary={selectedSummary}
                businesses={businesses}
                selectedBusinessId={selectedBusinessId}
                onSelectBusiness={setSelectedBusinessId}
                onOpenWorkspace={() => setActiveView('workspace')}
                onResetAnalytics={handleResetAnalytics}
                canResetAnalytics={canManageBilling}
                resettingAnalytics={resettingAnalytics}
                loadingEditor={loadingEditor}
              />
            </Suspense>
          ) : activeView === 'clients' ? (
            <Suspense
              fallback={
                <DashboardViewFallback
                  title="Carregando clientes"
                  description="Buscando acessos, tenant vinculado e dados comerciais da base atual."
                />
              }
            >
              <LazyAdminClientsPanel
                token={token}
                businesses={businesses}
                canManageBilling={canManageBilling}
                onOpenBusiness={(businessId) => {
                  setSelectedBusinessId(businessId);
                  setActiveView('workspace');
                }}
              />
            </Suspense>
          ) : (
            <Suspense
              fallback={
                <DashboardViewFallback
                  title="Carregando financeiro"
                  description="Buscando a integracao da plataforma com o Asaas e a configuracao do tenant selecionado."
                />
              }
            >
              <LazyAdminFinancialSettingsPanel
                token={token}
                businesses={businesses}
                selectedBusinessId={selectedBusinessId}
                onSelectBusiness={setSelectedBusinessId}
              />
            </Suspense>
          )}
        </div>
      </div>
    </AppShell>
  );
}
