import { Card } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';

export function TenantPreviewPanel({ previewUrl, publicUrl, businessName, previewKey, status, onRefresh }) {
  return (
    <Card className="admin-panel-card admin-preview-panel">
      <div className="admin-panel-card__header">
        <div>
          <h2>Preview publico</h2>
          <p>Visualize o estado salvo do site sem sair do backoffice.</p>
        </div>
        <div className="admin-toolbar admin-toolbar--compact">
          <div className="admin-toolbar__group admin-toolbar__group--end">
            <Button variant="secondary" onClick={onRefresh}>
              Atualizar preview
            </Button>
            {publicUrl ? (
              <Button href={publicUrl} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="admin-preview-panel__meta">
        <div className="admin-preview-panel__meta-card">
          <span>Tenant atual</span>
          <strong>{businessName || 'Nenhum tenant selecionado'}</strong>
        </div>
        <div className="admin-preview-panel__meta-card">
          <span>Status</span>
          <strong>{status || 'sem status'}</strong>
        </div>
      </div>

      {previewUrl ? (
        <div className="admin-preview-panel__frame">
          <iframe
            key={`${previewUrl}-${previewKey}`}
            title={`Preview ${businessName || 'tenant'}`}
            src={previewUrl}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="admin-preview-panel__empty">
          <strong>Sem preview disponivel</strong>
          <span>Selecione um tenant com slug valido para abrir a pagina publica ao lado do editor.</span>
        </div>
      )}
    </Card>
  );
}
