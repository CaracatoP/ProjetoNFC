import { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { AppShell } from '@/components/layout/AppShell.jsx';
import { DashboardOverviewGrid } from '@/components/business/DashboardOverviewGrid.jsx';
import { TenantEditorPanel } from '@/components/business/TenantEditorPanel.jsx';
import { TenantListPanel } from '@/components/business/TenantListPanel.jsx';
import { TenantOnboardingForm } from '@/components/business/TenantOnboardingForm.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import {
  createAdminBusiness,
  deleteAdminBusiness,
  fetchAdminOverview,
  getAdminBusiness,
  listAdminBusinesses,
  updateAdminBusiness,
  updateAdminBusinessStatus,
  uploadAdminImage,
} from '@/services/adminService.js';

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

export function DashboardHomePage() {
  const { token, user, logout } = useAuth();
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

        setEditor(nextEditor);
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
  }, [selectedBusinessId, token]);

  async function refreshCollections(preferredBusinessId = '') {
    const [nextOverview, nextBusinesses] = await Promise.all([
      fetchAdminOverview(token),
      listAdminBusinesses(token),
    ]);

    setOverview(nextOverview);
    setBusinesses(nextBusinesses);
    setSelectedBusinessId((current) => {
      const candidate = preferredBusinessId || current;

      if (candidate && nextBusinesses.some((business) => business.id === candidate)) {
        return candidate;
      }

      return nextBusinesses[0]?.id || '';
    });
  }

  async function handleCreate(payload) {
    setCreating(true);
    setMessage('');
    setError('');

    try {
      const createdEditor = await createAdminBusiness(token, payload);
      setEditor(createdEditor);
      await refreshCollections(createdEditor.business.id);
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
      setEditor(updatedEditor);
      await refreshCollections(draft.business.id);
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
      setEditor(updatedEditor);
      await refreshCollections(businessId);
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

  const selectedSummary = businesses.find((business) => business.id === selectedBusinessId) || null;

  return (
    <AppShell
      eyebrow="Admin Interno"
      title="Operacao central para paginas NFC multi-tenant"
      description="Cadastre comercios, gerencie tenants, ajuste branding, controle conteudo e use analytics para mostrar valor mensal ao cliente."
      shellClassName="dashboard-shell"
      heroClassName="dashboard-shell__hero"
      contentClassName="dashboard-shell__content"
    >
      <Card className="admin-panel-card admin-panel-card--hero">
        <div className="admin-editor-header">
          <div>
            <h2>Workspace da operacao</h2>
            <p>
              Logado como <strong>{user?.displayName || 'Admin'}</strong>. Sessao protegida por token, uploads no Cloudinary e operacao multi-tenant centralizada.
            </p>
          </div>
          <div className="admin-editor-actions">
            <Button variant="secondary" onClick={() => refreshCollections(selectedBusinessId)} disabled={loadingWorkspace}>
              {loadingWorkspace ? 'Atualizando...' : 'Atualizar dados'}
            </Button>
            {selectedSummary ? (
              <Button href={selectedSummary.publicUrl || `/site/${selectedSummary.slug}`} target="_blank" rel="noreferrer">
                Abrir pagina publica
              </Button>
            ) : null}
            <Button variant="secondary" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>

        {overview?.uploadConfig ? (
          <div className="admin-mini-stats">
            <div>
              <span>Uploads preparados</span>
              <strong>{overview.uploadConfig.maxFileSizeMb} MB por arquivo</strong>
            </div>
            <div>
              <span>Formatos aceitos</span>
              <strong>{overview.uploadConfig.acceptedMimeTypes.join(', ')}</strong>
            </div>
          </div>
        ) : null}
      </Card>

      {message ? <p className="admin-status-banner admin-status-banner--success">{message}</p> : null}
      {error ? <p className="admin-status-banner admin-status-banner--error">{error}</p> : null}

      {loadingWorkspace && !overview ? (
        <EmptyState title="Carregando dashboard" description="Buscando tenants, analytics e configuracoes da operacao." />
      ) : (
        <>
          <DashboardOverviewGrid overview={overview} />

          <div className="admin-workspace">
            <div className="admin-sidebar-stack">
              <TenantOnboardingForm creating={creating} onCreate={handleCreate} />
              <TenantListPanel
                businesses={businesses}
                selectedBusinessId={selectedBusinessId}
                loading={loadingWorkspace}
                onSelect={setSelectedBusinessId}
              />
            </div>

            <div className="admin-editor-column">
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
                  onSave={handleSave}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                  onUpload={handleUpload}
                />
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
