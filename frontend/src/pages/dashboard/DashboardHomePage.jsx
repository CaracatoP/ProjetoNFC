import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { AppShell } from '@/components/layout/AppShell.jsx';
import { DashboardOverviewGrid } from '@/components/business/DashboardOverviewGrid.jsx';
import { TenantEditorPanel } from '@/components/business/TenantEditorPanel.jsx';
import { TenantListPanel } from '@/components/business/TenantListPanel.jsx';
import { TenantOnboardingForm } from '@/components/business/TenantOnboardingForm.jsx';
import { TenantPreviewPanel } from '@/components/business/TenantPreviewPanel.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue.js';
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

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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
  const nextName = buildUniqueSuffix(editor.business.name || 'Novo tenant', businesses.map((business) => business.name), (value, attempt) =>
    attempt === 1 ? `${value} (copy)` : `${value} (copy ${attempt})`,
  );
  const nextSlug = buildUniqueSuffix(editor.business.slug || slugify(nextName), businesses.map((business) => business.slug), (value, attempt) => {
    const base = slugify(`${value}-copy`);
    return attempt === 1 ? base : `${base}-${attempt}`;
  });

  return {
    business: {
      ...editor.business,
      name: nextName,
      slug: nextSlug,
    },
    theme: editor.theme,
    links: editor.links,
    sections: editor.sections,
    nfcTag: editor.nfcTag ? { ...editor.nfcTag, code: '' } : null,
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
  const [duplicating, setDuplicating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tenantSearchInput, setTenantSearchInput] = useState('');
  const [tenantSort, setTenantSort] = useState('newest');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('all');
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const debouncedTenantSearch = useDebouncedValue(tenantSearchInput, 300);

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
      setPreviewRefreshKey((current) => current + 1);
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
      setPreviewRefreshKey((current) => current + 1);
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
      setPreviewRefreshKey((current) => current + 1);
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
      setPreviewRefreshKey((current) => current + 1);
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
      setEditor(duplicatedEditor);
      await refreshCollections(duplicatedEditor.business.id);
      setPreviewRefreshKey((current) => current + 1);
      setMessage('Tenant duplicado com sucesso. O codigo NFC foi limpo para evitar conflito no clone.');
    } catch (duplicateError) {
      setError(getErrorMessage(duplicateError));
    } finally {
      setDuplicating(false);
    }
  }

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

  const selectedSummary = businesses.find((business) => business.id === selectedBusinessId) || null;
  const previewUrl =
    selectedSummary?.slug && typeof window !== 'undefined'
      ? `${window.location.origin}/site/${selectedSummary.slug}`
      : selectedSummary?.publicUrl || '';

  return (
    <AppShell
      eyebrow="TapLink Admin"
      title="Operacao central do TapLink"
      description="Cadastre comercios, gerencie tenants, ajuste branding, controle conteudo e acompanhe analytics em uma operacao multi-tenant centralizada."
      shellClassName="dashboard-shell"
      heroClassName="dashboard-shell__hero"
      contentClassName="dashboard-shell__content"
      pageTitle="TapLink | Dashboard"
    >
      <Card className="admin-panel-card admin-panel-card--hero">
        <div className="admin-editor-header">
          <div>
            <h2>Workspace da operacao</h2>
            <p>
              Logado como <strong>{user?.displayName || 'Admin'}</strong>. Sessao protegida por token, uploads no Cloudinary e operacao centralizada do TapLink.
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
            {selectedSummary ? (
              <Button variant="secondary" onClick={handleCopyPublicLink}>
                Copiar link publico
              </Button>
            ) : null}
            <Button variant="secondary" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>

        <div className="admin-mini-stats">
          <div className="admin-mini-stat-card">
            <span>Tenant em foco</span>
            <strong>{selectedSummary?.name || 'Nenhum tenant selecionado'}</strong>
            <small>{selectedSummary ? `/site/${selectedSummary.slug}` : 'Selecione um tenant na coluna lateral para editar.'}</small>
          </div>
          <div className="admin-mini-stat-card">
            <span>Status operacional</span>
            <strong>{selectedSummary?.status || 'Sem status'}</strong>
            <small>{selectedSummary ? 'Controle manual de disponibilidade da pagina publica.' : 'Status aparece assim que houver um tenant ativo na area.'}</small>
          </div>
          {overview?.uploadConfig ? (
            <>
              <div className="admin-mini-stat-card">
                <span>Uploads preparados</span>
                <strong>{overview.uploadConfig.maxFileSizeMb} MB por arquivo</strong>
                <small>Cloudinary pelo backend com validacao de imagem.</small>
              </div>
              <div className="admin-mini-stat-card">
                <span>Formatos aceitos</span>
                <strong>{overview.uploadConfig.acceptedMimeTypes.join(', ')}</strong>
                <small>Fluxo pronto para logo, banner, favicon e galerias.</small>
              </div>
            </>
          ) : null}
        </div>
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
                    />
                  )}
                </div>

                <TenantPreviewPanel
                  previewUrl={previewUrl}
                  publicUrl={selectedSummary?.publicUrl || ''}
                  businessName={selectedSummary?.name || ''}
                  status={selectedSummary?.status || ''}
                  previewKey={previewRefreshKey}
                  onRefresh={() => setPreviewRefreshKey((current) => current + 1)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
