import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { AdminField, SectionEyebrow } from './editor/TenantEditorPrimitives.jsx';

function formatMetric(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDayLabel(date) {
  if (!date) {
    return '';
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function getPeakValue(series = [], field) {
  return Math.max(1, ...series.map((point) => point?.[field] || 0));
}

function AnalyticsMetricCard({ label, value, description, accent = 'default' }) {
  return (
    <div className={`analytics-metric-card analytics-metric-card--${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {description ? <small>{description}</small> : null}
    </div>
  );
}

function AnalyticsTrendChart({ title, description, series = [] }) {
  const maxTotal = getPeakValue(series, 'totalEvents');
  const maxViews = getPeakValue(series, 'pageViews');
  const maxInteractions = getPeakValue(series, 'interactions');
  const hasData = series.some((point) => point.totalEvents > 0 || point.pageViews > 0 || point.interactions > 0);

  return (
    <Card className="admin-panel-card analytics-panel">
      <div className="admin-panel-card__header admin-panel-card__header--compact">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {hasData ? (
        <div className="analytics-trend-chart">
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
                <span>{formatDayLabel(point.date)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state">
          <strong>Sem volume suficiente ainda</strong>
          <span>Assim que o site receber visitas e interacoes, o grafico aparece aqui.</span>
        </div>
      )}

      <div className="analytics-legend">
        <span><i className="analytics-legend__swatch analytics-legend__swatch--events" />Eventos</span>
        <span><i className="analytics-legend__swatch analytics-legend__swatch--views" />Visitas</span>
        <span><i className="analytics-legend__swatch analytics-legend__swatch--actions" />Interacoes</span>
      </div>
    </Card>
  );
}

function AnalyticsBarList({ title, description, items = [], emptyText = 'Sem dados ainda.' }) {
  const maxValue = Math.max(1, ...items.map((item) => item.count || 0));

  return (
    <Card className="admin-panel-card analytics-panel">
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
                {item.businessName ? <span>{item.businessName}</span> : null}
              </div>
              <div className="analytics-bar-list__meta">
                <b>{formatMetric(item.count)}</b>
                <div className="analytics-bar-list__track" aria-hidden="true">
                  <span style={{ width: `${Math.max(10, ((item.count || 0) / maxValue) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state">
          <strong>{emptyText}</strong>
          <span>Os rankings aparecem automaticamente quando houver uso suficiente.</span>
        </div>
      )}
    </Card>
  );
}

function AnalyticsBreakdownCard({ title, description, items = [], emptyText = 'Sem dados ainda.' }) {
  return (
    <Card className="admin-panel-card analytics-panel">
      <div className="admin-panel-card__header admin-panel-card__header--compact">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {items.length ? (
        <div className="analytics-breakdown-list">
          {items.map((item) => (
            <div key={item.label} className="analytics-breakdown-list__item">
              <div>
                <strong>{item.label}</strong>
                <span>{formatMetric(item.count)} evento(s)</span>
              </div>
              <b>{formatPercent(item.share)}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state">
          <strong>{emptyText}</strong>
          <span>Quando houver mais acessos, a distribuicao aparece automaticamente.</span>
        </div>
      )}
    </Card>
  );
}

function AnalyticsRecentEvents({ events = [] }) {
  return (
    <Card className="admin-panel-card analytics-panel">
      <div className="admin-panel-card__header admin-panel-card__header--compact">
        <div>
          <h2>Eventos recentes</h2>
          <p>Ultimas interacoes processadas no workspace.</p>
        </div>
      </div>

      {events.length ? (
        <div className="admin-event-list admin-event-list--scroll analytics-recent-events">
          {events.map((event) => (
            <div key={event.id} className="admin-event-item admin-event-item--analytics">
              <div>
                <strong>{event.businessName}</strong>
                <span>{event.targetLabel || event.targetType || event.eventType}</span>
                <small>{event.eventType}</small>
              </div>
              <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('pt-BR')}</time>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state">
          <strong>Sem eventos recentes</strong>
          <span>O feed aparece assim que as primeiras interacoes forem registradas.</span>
        </div>
      )}
    </Card>
  );
}

function TenantAnalyticsCard({ summary, analytics, loading, onOpenWorkspace }) {
  if (!summary) {
    return (
      <Card className="admin-panel-card analytics-panel analytics-panel--span-2">
        <EmptyState title="Nenhum tenant em foco" description="Selecione um tenant para ver o detalhe das metricas dele." />
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="admin-panel-card analytics-panel analytics-panel--span-2">
        <div className="analytics-empty-state">
          <strong>Carregando tenant selecionado</strong>
          <span>Buscando as metricas detalhadas para {summary.name}.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="admin-panel-card analytics-panel analytics-panel--span-2">
      <div className="admin-panel-card__header">
        <div>
          <SectionEyebrow>Tenant em foco</SectionEyebrow>
          <h2>{summary.name}</h2>
          <p>Detalhe de desempenho do tenant atualmente selecionado no dashboard.</p>
        </div>
        <div className="analytics-tenant-header__actions">
          <span className={`tenant-list__status tenant-list__status--${summary.status}`}>{summary.status}</span>
          <Button variant="secondary" onClick={onOpenWorkspace}>
            Abrir editor
          </Button>
        </div>
      </div>

      <div className="analytics-metric-grid analytics-metric-grid--tenant">
        <AnalyticsMetricCard label="Eventos totais" value={formatMetric(analytics?.totalEvents)} description="Tudo que esse tenant ja registrou." />
        <AnalyticsMetricCard label="Visitas" value={formatMetric(analytics?.pageViews)} description="Page views enviados pelo site publico." accent="info" />
        <AnalyticsMetricCard label="Atalhos usados" value={formatMetric(analytics?.shortcutClicks)} description="Acoes rapidas acionadas no tenant." accent="accent" />
        <AnalyticsMetricCard label="Taxa de interacao" value={formatPercent(analytics?.actionRate)} description="Interacoes por page view." accent="success" />
      </div>

      <div className="analytics-subgrid analytics-subgrid--tenant">
        <AnalyticsTrendChart
          title="Ritmo do tenant"
          description="Visitas e interacoes dos ultimos 14 dias."
          series={analytics?.timeline || []}
        />
        <AnalyticsBarList
          title="Atalhos do tenant"
          description="Quais acessos rapidos mais convertem nesse tenant."
          items={analytics?.topShortcuts || []}
          emptyText="Nenhum atalho usado ainda."
        />
      </div>
    </Card>
  );
}

export function AdminAnalyticsView({
  overview,
  editor,
  selectedSummary,
  businesses,
  selectedBusinessId,
  onSelectBusiness,
  onOpenWorkspace,
  loadingEditor,
}) {
  if (!overview) {
    return null;
  }

  const analytics = overview.analytics || {};
  const highlights = analytics.highlights || {};

  return (
    <div className="admin-analytics-view">
      <Card className="admin-panel-card admin-panel-card--hero analytics-overview-hero">
        <div className="admin-panel-card__header">
          <div>
            <SectionEyebrow>Analises</SectionEyebrow>
            <h2>Centro de analytics</h2>
            <p>Todos os dados de uso da operacao em um unico lugar, com leitura global e detalhe por tenant.</p>
          </div>
          <div className="analytics-hero__controls">
            <AdminField label="Tenant em foco">
              <select value={selectedBusinessId || ''} onChange={(event) => onSelectBusiness?.(event.target.value)}>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <Button variant="secondary" onClick={onOpenWorkspace}>
              Voltar para operacao
            </Button>
          </div>
        </div>

        <div className="analytics-metric-grid">
          <AnalyticsMetricCard label="Eventos totais" value={formatMetric(highlights.totalEvents)} description="Soma de visitas e interacoes do workspace." />
          <AnalyticsMetricCard label="Visitas" value={formatMetric(highlights.pageViews)} description="Page views coletados no site publico." accent="info" />
          <AnalyticsMetricCard label="Cliques em links" value={formatMetric(highlights.linkClicks)} description="Cliques em links e acoes externas." accent="accent" />
          <AnalyticsMetricCard label="Atalhos usados" value={formatMetric(highlights.shortcutClicks)} description="WhatsApp, telefone, Wi-Fi, PIX e similares." accent="accent" />
          <AnalyticsMetricCard label="Visitantes unicos" value={formatMetric(highlights.uniqueVisitors)} description="Baseado em hash anonimo do visitante." accent="success" />
          <AnalyticsMetricCard label="Taxa de interacao" value={formatPercent(highlights.actionRate)} description="Interacoes totais por page view." accent="success" />
        </div>
      </Card>

      <div className="analytics-layout-grid">
        <AnalyticsTrendChart
          title="Visitas ao longo do tempo"
          description="Historico diario dos ultimos 14 dias para acompanhar tracao e comportamento."
          series={analytics.timeline || []}
        />
        <AnalyticsBarList
          title="Mix de eventos"
          description="Quais comportamentos sao mais frequentes hoje na operacao."
          items={analytics.byEventType || []}
          emptyText="Nenhum tipo de evento registrado ainda."
        />
        <AnalyticsBarList
          title="Tenants mais acessados"
          description="Paginas publicas com mais atividade no periodo atual."
          items={(analytics.topTenants || []).map((item) => ({
            key: item.businessId,
            label: item.name,
            businessName: `/${item.slug}`,
            count: item.eventCount,
          }))}
          emptyText="Nenhum tenant com volume registrado ainda."
        />
        <AnalyticsBarList
          title="Links mais clicados"
          description="Ranking dos links e CTAs que mais recebem interacao."
          items={analytics.topLinks || []}
          emptyText="Nenhum link clicado ainda."
        />
        <AnalyticsBarList
          title="Atalhos mais usados"
          description="Acoes rapidas que mais ajudam conversao e atendimento."
          items={analytics.topShortcuts || []}
          emptyText="Nenhum atalho usado ainda."
        />
        <AnalyticsBreakdownCard
          title="Dispositivos"
          description="Visibilidade do tipo de aparelho que chega ao site."
          items={analytics.devices || []}
          emptyText="Ainda nao ha informacao de dispositivos."
        />
        <AnalyticsBreakdownCard
          title="Navegadores"
          description="Leitura rapida de compatibilidade e origem de uso."
          items={analytics.browsers || []}
          emptyText="Ainda nao ha informacao de navegadores."
        />
        <AnalyticsRecentEvents events={analytics.recentEvents || []} />
        <TenantAnalyticsCard
          summary={selectedSummary}
          analytics={editor?.analytics}
          loading={loadingEditor}
          onOpenWorkspace={onOpenWorkspace}
        />
      </div>
    </div>
  );
}

