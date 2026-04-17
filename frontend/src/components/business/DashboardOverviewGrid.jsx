import { Card } from '@/components/common/Card.jsx';

function StatCard({ label, value, tone = 'default' }) {
  return (
    <Card className={`admin-stat-card admin-stat-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
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
        <StatCard label="Tenants ativos" value={overview.totals.activeBusinesses} tone="success" />
        <StatCard label="Rascunhos" value={overview.totals.draftBusinesses} tone="accent" />
        <StatCard label="Eventos totais" value={overview.totals.totalEvents} />
        <StatCard label="Ultimos 7 dias" value={overview.totals.last7DaysEvents} tone="info" />
      </div>

      <div className="admin-analytics-grid">
        <Card className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Tenants com mais interacao</h2>
              <p>Os negocios mais acessados no momento.</p>
            </div>
          </div>
          <div className="admin-ranked-list admin-ranked-list--scroll">
            {overview.topBusinesses.length ? (
              overview.topBusinesses.map((business) => (
                <div key={business.businessId} className="admin-ranked-item">
                  <div>
                    <strong>{business.name}</strong>
                    <span>{business.slug}</span>
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
          </div>
          <div className="admin-event-list admin-event-list--scroll">
            {overview.recentEvents.length ? (
              overview.recentEvents.map((event) => (
                <div key={event.id} className="admin-event-item">
                  <div>
                    <strong>{event.businessName}</strong>
                    <span>
                      {event.eventType}
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
