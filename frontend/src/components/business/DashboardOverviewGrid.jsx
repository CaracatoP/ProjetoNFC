import { Card } from '@/components/common/Card.jsx';

function formatEventTypeLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatCard({ label, value, tone = 'default', description, eyebrow }) {
  return (
    <Card className={`admin-stat-card admin-stat-card--${tone}`}>
      <span className="admin-stat-card__eyebrow">{eyebrow || label}</span>
      <strong>{value}</strong>
      {description ? <small>{description}</small> : null}
    </Card>
  );
}

export function DashboardOverviewGrid({ overview }) {
  if (!overview) {
    return null;
  }

  return (
    <div className="admin-overview-stack">
      <div className="admin-overview-grid">
        <StatCard
          label="Tenants ativos"
          value={overview.totals.activeBusinesses}
          tone="success"
          description="Operacoes publicas liberadas no momento."
          eyebrow="Ativos"
        />
        <StatCard
          label="Rascunhos"
          value={overview.totals.draftBusinesses}
          tone="accent"
          description="Espacos ainda em configuracao ou revisao."
          eyebrow="Em preparo"
        />
        <StatCard
          label="Eventos totais"
          value={overview.totals.totalEvents}
          description="Interacoes acumuladas desde o inicio do workspace."
          eyebrow="Volume"
        />
        <StatCard
          label="Ultimos 7 dias"
          value={overview.totals.last7DaysEvents}
          tone="info"
          description="Atividade recente para acompanhar tendencia."
          eyebrow="Semana"
        />
      </div>

      <div className="admin-analytics-grid">
        <Card className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Tenants com mais interacao</h2>
              <p>Os negocios mais acessados no momento.</p>
            </div>
            <span className="admin-section-chip admin-section-chip--accent">
              {overview.topBusinesses.length} destaque(s)
            </span>
          </div>
          <div className="admin-ranked-list admin-ranked-list--scroll">
            {overview.topBusinesses.length ? (
              overview.topBusinesses.map((business) => (
                <div key={business.businessId} className="admin-ranked-item">
                  <div>
                    <strong>{business.name}</strong>
                    <span>/{business.slug}</span>
                    <small className="admin-ranked-item__hint">Tenant mais acionado no periodo atual.</small>
                  </div>
                  <b>{business.eventCount} eventos</b>
                </div>
              ))
            ) : (
              <p className="admin-muted-copy">Nenhum evento registrado ainda.</p>
            )}
          </div>
        </Card>

        <Card className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Eventos recentes</h2>
              <p>Ultimas interacoes registradas na plataforma.</p>
            </div>
            <span className="admin-section-chip admin-section-chip--muted">
              {overview.recentEvents.length} registro(s)
            </span>
          </div>
          <div className="admin-event-list admin-event-list--scroll">
            {overview.recentEvents.length ? (
              overview.recentEvents.map((event) => (
                <div key={event.id} className="admin-event-item">
                  <div>
                    <strong>{event.businessName}</strong>
                    <span>
                      {formatEventTypeLabel(event.eventType)}
                      {event.targetLabel ? ` - ${event.targetLabel}` : ''}
                    </span>
                  </div>
                  <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('pt-BR')}</time>
                </div>
              ))
            ) : (
              <p className="admin-muted-copy">Sem eventos ainda.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
