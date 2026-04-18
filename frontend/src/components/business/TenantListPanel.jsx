import { Card } from '@/components/common/Card.jsx';
import { resolveMediaUrl } from '@/utils/formatters.js';

export function TenantListPanel({ businesses, selectedBusinessId, loading, onSelect }) {
  return (
    <Card className="admin-panel-card admin-panel-card--sidebar">
      <div className="admin-panel-card__header">
        <div>
          <h2>Tenants</h2>
          <p>Selecione um comercio para editar conteudo, tema e operacao.</p>
        </div>
      </div>

      <div className="tenant-list">
        {loading ? <p className="admin-muted-copy">Carregando tenants...</p> : null}

        {!loading && !businesses.length ? <p className="admin-muted-copy">Nenhum tenant cadastrado ainda.</p> : null}

        {businesses.map((business) => (
          <button
            key={business.id}
            type="button"
            className={`tenant-list__item ${selectedBusinessId === business.id ? 'tenant-list__item--active' : ''}`}
            onClick={() => onSelect?.(business.id)}
          >
            <div className="tenant-list__meta">
              {business.logoUrl ? <img src={resolveMediaUrl(business.logoUrl)} alt={business.name} className="tenant-list__logo" /> : null}
              <div>
                <strong>{business.name}</strong>
                <span>{business.slug}</span>
              </div>
            </div>
            <div className="tenant-list__stats">
              <span>{business.status}</span>
              <small>{business.analytics.totalEvents} eventos</small>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
