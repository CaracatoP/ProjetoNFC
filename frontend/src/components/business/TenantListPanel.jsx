import { Card } from '@/components/common/Card.jsx';
import { resolveMediaUrl } from '@/utils/formatters.js';

export function TenantListPanel({
  businesses,
  selectedBusinessId,
  loading,
  onSelect,
  searchValue,
  onSearchChange,
  sortValue,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
}) {
  return (
    <Card className="admin-panel-card admin-panel-card--sidebar">
      <div className="admin-panel-card__header">
        <div>
          <h2>Tenants</h2>
          <p>Selecione um comercio para editar conteudo, tema e operacao.</p>
        </div>
        <span className="admin-section-chip admin-section-chip--accent">{businesses.length} no painel</span>
      </div>

      <div className="admin-sidebar-filters">
        <label className="admin-field">
          <span>Buscar tenant</span>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Buscar por nome ou slug"
          />
        </label>
        <div className="admin-sidebar-filters__grid">
          <label className="admin-field">
            <span>Ordenar por</span>
            <select value={sortValue} onChange={(event) => onSortChange?.(event.target.value)}>
              <option value="newest">mais novos</option>
              <option value="active">ativos primeiro</option>
              <option value="alphabetical">ordem alfabetica</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Filtrar status</span>
            <select value={statusFilter} onChange={(event) => onStatusFilterChange?.(event.target.value)}>
              <option value="all">todos</option>
              <option value="active">ativos</option>
              <option value="inactive">inativos</option>
              <option value="draft">draft</option>
            </select>
          </label>
        </div>
      </div>

      <div className="tenant-list">
        {loading ? <p className="admin-muted-copy">Carregando tenants...</p> : null}

        {!loading && !businesses.length ? <p className="admin-muted-copy">Nenhum tenant encontrado com esse filtro.</p> : null}

        {businesses.map((business) => (
          <button
            key={business.id}
            type="button"
            className={`tenant-list__item ${selectedBusinessId === business.id ? 'tenant-list__item--active' : ''}`}
            onClick={() => onSelect?.(business.id)}
          >
            <div className="tenant-list__meta">
              {business.logoUrl ? <img src={resolveMediaUrl(business.logoUrl)} alt={business.name} className="tenant-list__logo" /> : null}
              <div className="tenant-list__meta-copy">
                <strong>{business.name}</strong>
                <span className="tenant-list__path">/site/{business.slug}</span>
                <small className="tenant-list__foot">
                  {selectedBusinessId === business.id ? 'Tenant aberto no editor.' : 'Clique para editar este tenant.'}
                </small>
              </div>
            </div>
            <div className="tenant-list__stats">
              <span className={`tenant-list__status tenant-list__status--${business.status}`}>{business.status}</span>
              {selectedBusinessId === business.id ? <span className="tenant-list__selection">Selecionado</span> : null}
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
