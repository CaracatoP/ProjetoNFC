import { Button } from '@/components/common/Button.jsx';
import { SectionEyebrow } from './TenantEditorPrimitives.jsx';

export function TenantEditorHeader({
  business,
  nfcTag,
  totalEvents,
  publicUrl,
  isActive,
  saving,
  deleting,
  duplicating,
  togglingStatus,
  onCopyPublicLink,
  onDuplicate,
  onToggleStatus,
  onDelete,
  onSave,
}) {
  return (
    <div className="admin-editor-header admin-editor-header--hero">
      <div className="admin-editor-hero-main">
        <SectionEyebrow>Tenant em edicao</SectionEyebrow>
        <h2>{business.name}</h2>
        <p className="admin-editor-public-url">{publicUrl || `/site/${business.slug}`}</p>
        <div className="admin-editor-meta admin-editor-meta--hero">
          <span className="admin-meta-pill">Status: {business.status}</span>
          <span className="admin-meta-pill">Tag: {nfcTag?.code || 'Sem codigo NFC'}</span>
          <span className="admin-meta-pill">Eventos: {totalEvents || 0}</span>
        </div>
      </div>

      <div className="admin-editor-hero-actions">
        <div className="admin-toolbar admin-toolbar--editor">
          <div className="admin-toolbar__group admin-toolbar__group--utility">
            <Button variant="secondary" onClick={onCopyPublicLink} disabled={!publicUrl}>
              Copiar link
            </Button>
            <Button variant="secondary" onClick={onDuplicate} disabled={duplicating || deleting || saving}>
              {duplicating ? 'Duplicando...' : 'Duplicar tenant'}
            </Button>
          </div>
          <div className="admin-toolbar__group admin-toolbar__group--danger">
            <Button
              variant="secondary"
              onClick={() => onToggleStatus?.(business.id, isActive ? 'inactive' : 'active')}
              disabled={togglingStatus || deleting || saving || duplicating}
            >
              {togglingStatus ? (isActive ? 'Inativando...' : 'Ativando...') : isActive ? 'Inativar site' : 'Ativar site'}
            </Button>
            <Button
              variant="secondary"
              className="button--danger-tone"
              onClick={() => onDelete?.(business.id)}
              disabled={deleting || duplicating}
            >
              {deleting ? 'Excluindo...' : 'Excluir tenant'}
            </Button>
          </div>
          <div className="admin-toolbar__group admin-toolbar__group--primary">
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
