import { useEffect, useMemo, useState } from 'react';
import {
  BILLING_ACCESS_LABELS,
  BILLING_ACCESS_STATE_VALUES,
  ROLE_LEVEL_LABELS,
  ROLE_LEVELS,
} from '@shared/constants/access.js';
import { PLAN_CAPABILITY_DEFINITIONS, PLAN_TYPES } from '@shared/constants/plans.js';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { AdminField, SectionEyebrow } from '@/components/business/editor/TenantEditorPrimitives.jsx';
import {
  blockAdminClient,
  createAdminClientAccount,
  listAdminClients,
  resetAdminClientPassword,
  unblockAdminClient,
  updateAdminClientAccessLevel,
  updateAdminClientAccount,
  updateAdminClientBillingStatus,
  updateAdminClientPlan,
} from '@/services/adminService.js';

const CLIENT_ROLE_OPTIONS = [
  ROLE_LEVELS.CLIENT_OWNER,
  ROLE_LEVELS.MANAGER,
  ROLE_LEVELS.OPERATOR,
  ROLE_LEVELS.VIEWER,
];

const PLAN_OPTIONS = [PLAN_TYPES.STARTER, PLAN_TYPES.PRO, PLAN_TYPES.PREMIUM, PLAN_TYPES.ENTERPRISE];

function normalizeText(value) {
  return String(value || '').trim();
}

function getErrorMessage(error) {
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details
      .filter((detail) => detail?.message)
      .map((detail) => (detail.path ? `${detail.path}: ${detail.message}` : detail.message))
      .join(' | ');
  }

  return error?.message || 'Nao foi possivel concluir esta operacao.';
}

function createInitialCreateForm(businessId = '') {
  return {
    name: '',
    email: '',
    password: '',
    businessId,
    roleLevel: ROLE_LEVELS.CLIENT_OWNER,
    active: true,
  };
}

function createEditForm(client) {
  return {
    name: client?.user?.displayName || '',
    email: client?.user?.email || '',
    businessId: client?.business?.id || '',
    roleLevel: client?.user?.roleLevel ?? ROLE_LEVELS.CLIENT_OWNER,
    active: client?.user?.status !== 'disabled',
    planCode: client?.subscription?.plan?.code || PLAN_TYPES.STARTER,
    billingStatus: client?.access?.billingStatus || 'paid',
  };
}

function matchesClientSearch(client, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    client?.user?.displayName,
    client?.user?.email,
    client?.business?.name,
    client?.business?.slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(searchTerm);
}

function Badge({ children, tone = 'muted' }) {
  return <span className={`admin-section-chip admin-section-chip--${tone}`}>{children}</span>;
}

function ClientListItem({ client, selected, onSelect }) {
  const businessName = client?.business?.name || 'Tenant nao vinculado';
  const planLabel = client?.subscription?.plan?.name || client?.subscription?.plan?.code || 'Sem plano';
  const billingLabel = BILLING_ACCESS_LABELS[client?.access?.billingStatus] || client?.access?.billingStatus || 'Pago';
  const roleLabel = ROLE_LEVEL_LABELS[client?.user?.roleLevel] || `Nivel ${client?.user?.roleLevel ?? '-'}`;

  return (
    <button
      type="button"
      className={`admin-client-list__button ${selected ? 'admin-client-list__button--selected' : ''}`}
      onClick={onSelect}
    >
      <div className="admin-client-list__content">
        <strong>{client?.user?.displayName || 'Cliente sem nome'}</strong>
        <span>{client?.user?.email || 'Sem e-mail'}</span>
        <small>{businessName}</small>
      </div>
      <div className="admin-module-badges">
        <Badge tone="accent">{roleLabel}</Badge>
        <Badge>{planLabel}</Badge>
        <Badge tone={client?.access?.billingStatus === 'overdue' ? 'warning' : 'muted'}>{billingLabel}</Badge>
      </div>
    </button>
  );
}

export function AdminClientsPanel({
  token,
  businesses = [],
  canManageBilling = false,
  onOpenBusiness,
}) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [billingFilter, setBillingFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [createForm, setCreateForm] = useState(() => createInitialCreateForm(businesses[0]?.id || ''));
  const [editForm, setEditForm] = useState(() => createEditForm(null));
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  const businessOptions = useMemo(
    () =>
      [...businesses].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR')),
    [businesses],
  );

  useEffect(() => {
    if (!createForm.businessId && businessOptions[0]?.id) {
      setCreateForm((current) => ({ ...current, businessId: businessOptions[0].id }));
    }
  }, [businessOptions, createForm.businessId]);

  async function loadClients({ preserveSelection = true, nextSelectedId = '' } = {}) {
    setLoading(true);
    setError('');

    try {
      const nextClients = await listAdminClients(token);
      setClients(nextClients);
      setSelectedClientId((current) => {
        if (nextSelectedId && nextClients.some((client) => client.user?.id === nextSelectedId)) {
          return nextSelectedId;
        }

        if (preserveSelection && current && nextClients.some((client) => client.user?.id === current)) {
          return current;
        }

        return nextClients[0]?.user?.id || '';
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    loadClients({ preserveSelection: false });
  }, [token]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return clients.filter((client) => {
      if (planFilter !== 'all' && client?.subscription?.plan?.code !== planFilter) {
        return false;
      }

      if (billingFilter !== 'all' && client?.access?.billingStatus !== billingFilter) {
        return false;
      }

      if (levelFilter !== 'all' && String(client?.user?.roleLevel) !== levelFilter) {
        return false;
      }

      return matchesClientSearch(client, normalizedSearch);
    });
  }, [billingFilter, clients, levelFilter, planFilter, searchValue]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.user?.id === selectedClientId) || filteredClients[0] || null,
    [clients, filteredClients, selectedClientId],
  );

  useEffect(() => {
    setEditForm(createEditForm(selectedClient));
    setResetPasswordValue('');
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient && selectedClient.user?.id !== selectedClientId) {
      setSelectedClientId(selectedClient.user?.id || '');
    }
  }, [selectedClient, selectedClientId]);

  async function runMutation(action, successMessage, options = {}) {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const result = await action();
      await loadClients({ nextSelectedId: options.selectedClientId || result?.user?.id || selectedClientId });
      if (options.resetCreateForm) {
        setCreateForm(createInitialCreateForm(businessOptions[0]?.id || ''));
      }
      if (options.resetPassword) {
        setResetPasswordValue('');
      }
      setMessage(successMessage);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateClient() {
    if (!normalizeText(createForm.name) || !normalizeText(createForm.email) || !normalizeText(createForm.password) || !normalizeText(createForm.businessId)) {
      setError('Preencha nome, e-mail, senha inicial e tenant vinculado antes de criar o cliente.');
      return;
    }

    await runMutation(
      () =>
        createAdminClientAccount(token, {
          name: normalizeText(createForm.name),
          email: normalizeText(createForm.email),
          password: createForm.password,
          businessId: createForm.businessId,
          roleLevel: Number(createForm.roleLevel),
          active: Boolean(createForm.active),
        }),
      'Cliente criado com sucesso.',
      { resetCreateForm: true },
    );
  }

  async function handleSaveClient() {
    if (!selectedClient) {
      return;
    }

    await runMutation(
      () =>
        updateAdminClientAccount(token, selectedClient.user.id, {
          name: normalizeText(editForm.name),
          email: normalizeText(editForm.email),
          businessId: editForm.businessId,
          roleLevel: Number(editForm.roleLevel),
          active: Boolean(editForm.active),
        }),
      'Cliente atualizado com sucesso.',
      { selectedClientId: selectedClient.user.id },
    );
  }

  async function handleUpdateRoleLevel() {
    if (!selectedClient) {
      return;
    }

    await runMutation(
      () => updateAdminClientAccessLevel(token, selectedClient.user.id, Number(editForm.roleLevel)),
      'Nivel de acesso atualizado com sucesso.',
      { selectedClientId: selectedClient.user.id },
    );
  }

  async function handleResetPassword() {
    if (!selectedClient || normalizeText(resetPasswordValue).length < 8) {
      setError('Informe uma nova senha com pelo menos 8 caracteres.');
      return;
    }

    await runMutation(
      () => resetAdminClientPassword(token, selectedClient.user.id, resetPasswordValue),
      'Senha redefinida com sucesso.',
      { selectedClientId: selectedClient.user.id, resetPassword: true },
    );
  }

  async function handleUpdatePlan() {
    if (!selectedClient) {
      return;
    }

    await runMutation(
      () => updateAdminClientPlan(token, selectedClient.user.id, editForm.planCode),
      'Plano atualizado com sucesso.',
      { selectedClientId: selectedClient.user.id },
    );
  }

  async function handleUpdateBilling() {
    if (!selectedClient) {
      return;
    }

    await runMutation(
      () => updateAdminClientBillingStatus(token, selectedClient.user.id, editForm.billingStatus),
      'Status financeiro atualizado com sucesso.',
      { selectedClientId: selectedClient.user.id },
    );
  }

  async function handleToggleBlock() {
    if (!selectedClient) {
      return;
    }

    const isBlocked = selectedClient.user?.status === 'disabled';
    await runMutation(
      () => (isBlocked ? unblockAdminClient(token, selectedClient.user.id) : blockAdminClient(token, selectedClient.user.id)),
      isBlocked ? 'Acesso do cliente reativado com sucesso.' : 'Acesso do cliente bloqueado com sucesso.',
      { selectedClientId: selectedClient.user.id },
    );
  }

  if (loading && !clients.length) {
    return <EmptyState title="Carregando clientes" description="Buscando usuarios vinculados aos tenants, planos e status financeiros atuais." />;
  }

  return (
    <div className="admin-dashboard-flow">
      {message ? <p className="admin-status-banner admin-status-banner--success">{message}</p> : null}
      {error ? <p className="admin-status-banner admin-status-banner--error">{error}</p> : null}

      <div className="admin-clients-layout">
        <div className="admin-clients-sidebar">
          <Card className="admin-panel-card">
            <div className="admin-panel-card__header">
              <div>
                <SectionEyebrow>Clientes</SectionEyebrow>
                <h2>Base comercial</h2>
                <p>Crie acessos dos tenants, filtre por status e acompanhe quem ja esta pronto para operar.</p>
              </div>
              <Button variant="secondary" disabled={loading} onClick={() => loadClients()}>
                {loading ? 'Atualizando...' : 'Atualizar lista'}
              </Button>
            </div>

            <div className="admin-card-stack">
              <div className="admin-form-grid">
                <AdminField label="Buscar cliente">
                  <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Nome, e-mail ou tenant" />
                </AdminField>
                <AdminField label="Plano">
                  <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    {PLAN_OPTIONS.map((planCode) => (
                      <option key={planCode} value={planCode}>
                        {PLAN_CAPABILITY_DEFINITIONS[planCode]?.label || planCode}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField label="Status financeiro">
                  <select value={billingFilter} onChange={(event) => setBillingFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    {BILLING_ACCESS_STATE_VALUES.map((status) => (
                      <option key={status} value={status}>
                        {BILLING_ACCESS_LABELS[status] || status}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField label="Nivel">
                  <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    {CLIENT_ROLE_OPTIONS.map((level) => (
                      <option key={level} value={String(level)}>
                        {ROLE_LEVEL_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </div>

              {filteredClients.length ? (
                <div className="admin-client-list">
                  {filteredClients.map((client) => (
                    <ClientListItem
                      key={client.user?.id}
                      client={client}
                      selected={client.user?.id === selectedClient?.user?.id}
                      onSelect={() => setSelectedClientId(client.user?.id || '')}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhum cliente encontrado" description="Ajuste os filtros ou crie um novo acesso para algum tenant da operacao." />
              )}
            </div>
          </Card>

          <Card className="admin-panel-card">
            <div className="admin-panel-card__header">
              <div>
                <SectionEyebrow>Novo acesso</SectionEyebrow>
                <h2>Cadastrar cliente</h2>
                <p>Niveis 0 e 1 conseguem criar usuarios dos niveis 2 a 5 e vincular o acesso ao tenant correto.</p>
              </div>
            </div>

            {!businessOptions.length ? (
              <EmptyState title="Nenhum tenant disponivel" description="Crie um tenant primeiro para vincular o cliente a um negocio." />
            ) : (
              <div className="admin-card-stack">
                <div className="admin-form-grid">
                  <AdminField label="Nome">
                    <input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} />
                  </AdminField>
                  <AdminField label="E-mail">
                    <input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} />
                  </AdminField>
                  <AdminField label="Senha inicial">
                    <input type="password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} />
                  </AdminField>
                  <AdminField label="Tenant vinculado">
                    <select value={createForm.businessId} onChange={(event) => setCreateForm((current) => ({ ...current, businessId: event.target.value }))}>
                      {businessOptions.map((business) => (
                        <option key={business.id} value={business.id}>
                          {business.name}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Nivel">
                    <select value={String(createForm.roleLevel)} onChange={(event) => setCreateForm((current) => ({ ...current, roleLevel: Number(event.target.value) }))}>
                      {CLIENT_ROLE_OPTIONS.map((level) => (
                        <option key={level} value={String(level)}>
                          {ROLE_LEVEL_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Status operacional">
                    <select value={createForm.active ? 'active' : 'disabled'} onChange={(event) => setCreateForm((current) => ({ ...current, active: event.target.value === 'active' }))}>
                      <option value="active">Ativo</option>
                      <option value="disabled">Bloqueado</option>
                    </select>
                  </AdminField>
                </div>

                <Button disabled={saving || !businessOptions.length} onClick={handleCreateClient}>
                  {saving ? 'Criando acesso...' : 'Criar cliente'}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="admin-editor-column">
          {selectedClient ? (
            <div className="admin-card-stack admin-card-stack--airy">
              <Card className="admin-panel-card">
                <div className="admin-panel-card__header">
                  <div>
                    <SectionEyebrow>Perfil do cliente</SectionEyebrow>
                    <h2>{selectedClient.user?.displayName || 'Cliente selecionado'}</h2>
                    <p>Edite dados operacionais, tenant vinculado e nivel de acesso sem tocar no login interno do sistema.</p>
                  </div>
                  <div className="admin-module-badges">
                    <Badge tone="accent">{ROLE_LEVEL_LABELS[selectedClient.user?.roleLevel] || `Nivel ${selectedClient.user?.roleLevel}`}</Badge>
                    <Badge>{selectedClient.subscription?.plan?.name || selectedClient.subscription?.plan?.code || 'Sem plano'}</Badge>
                    <Badge tone={selectedClient.access?.billingStatus === 'overdue' ? 'warning' : 'muted'}>
                      {BILLING_ACCESS_LABELS[selectedClient.access?.billingStatus] || selectedClient.access?.billingStatus || 'Pago'}
                    </Badge>
                  </div>
                </div>

                <div className="admin-client-summary-grid">
                  <div className="admin-mini-stat-card">
                    <span>Tenant vinculado</span>
                    <strong>{selectedClient.business?.name || 'Sem tenant'}</strong>
                    <small>{selectedClient.business?.slug ? `/site/${selectedClient.business.slug}` : 'Sem slug publico'}</small>
                  </div>
                  <div className="admin-mini-stat-card">
                    <span>Status operacional</span>
                    <strong>{selectedClient.user?.status === 'disabled' ? 'Bloqueado' : 'Ativo'}</strong>
                    <small>Controle manual do acesso ao painel.</small>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <AdminField label="Nome">
                    <input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
                  </AdminField>
                  <AdminField label="E-mail">
                    <input type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} />
                  </AdminField>
                  <AdminField label="Tenant vinculado">
                    <select value={editForm.businessId} onChange={(event) => setEditForm((current) => ({ ...current, businessId: event.target.value }))}>
                      {businessOptions.map((business) => (
                        <option key={business.id} value={business.id}>
                          {business.name}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Nivel">
                    <select value={String(editForm.roleLevel)} onChange={(event) => setEditForm((current) => ({ ...current, roleLevel: Number(event.target.value) }))}>
                      {CLIENT_ROLE_OPTIONS.map((level) => (
                        <option key={level} value={String(level)}>
                          {ROLE_LEVEL_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Status operacional">
                    <select value={editForm.active ? 'active' : 'disabled'} onChange={(event) => setEditForm((current) => ({ ...current, active: event.target.value === 'active' }))}>
                      <option value="active">Ativo</option>
                      <option value="disabled">Bloqueado</option>
                    </select>
                  </AdminField>
                </div>

                <div className="admin-inline-actions">
                  <Button disabled={saving} onClick={handleSaveClient}>
                    {saving ? 'Salvando...' : 'Salvar cliente'}
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={handleUpdateRoleLevel}>
                    Atualizar nivel
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={handleToggleBlock}>
                    {selectedClient.user?.status === 'disabled' ? 'Desbloquear acesso' : 'Bloquear acesso'}
                  </Button>
                  {selectedClient.business?.id ? (
                    <Button
                      variant="secondary"
                      onClick={() => onOpenBusiness?.(selectedClient.business.id)}
                    >
                      Abrir tenant no workspace
                    </Button>
                  ) : null}
                </div>
              </Card>

              <Card className="admin-panel-card">
                <div className="admin-panel-card__header">
                  <div>
                    <SectionEyebrow>Seguranca</SectionEyebrow>
                    <h2>Reset de senha</h2>
                    <p>Niveis 0 e 1 conseguem redefinir a senha de usuarios dos niveis 2 a 5 sem mexer no proprio login interno.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <AdminField label="Nova senha">
                    <input type="password" value={resetPasswordValue} onChange={(event) => setResetPasswordValue(event.target.value)} placeholder="Minimo de 8 caracteres" />
                  </AdminField>
                </div>

                <div className="admin-inline-actions">
                  <Button disabled={saving} onClick={handleResetPassword}>
                    {saving ? 'Atualizando...' : 'Resetar senha'}
                  </Button>
                </div>
              </Card>

              <Card className="admin-panel-card">
                <div className="admin-panel-card__header">
                  <div>
                    <SectionEyebrow>Plano e cobranca</SectionEyebrow>
                    <h2>Controles financeiros</h2>
                    <p>Somente o nivel 0 pode alterar plano contratado e status financeiro. O nivel 1 continua apenas visualizando estes dados.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <AdminField label="Plano contratado">
                    <select
                      value={editForm.planCode}
                      disabled={!canManageBilling}
                      onChange={(event) => setEditForm((current) => ({ ...current, planCode: event.target.value }))}
                    >
                      {PLAN_OPTIONS.map((planCode) => (
                        <option key={planCode} value={planCode}>
                          {PLAN_CAPABILITY_DEFINITIONS[planCode]?.label || planCode}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Status financeiro">
                    <select
                      value={editForm.billingStatus}
                      disabled={!canManageBilling}
                      onChange={(event) => setEditForm((current) => ({ ...current, billingStatus: event.target.value }))}
                    >
                      {BILLING_ACCESS_STATE_VALUES.map((status) => (
                        <option key={status} value={status}>
                          {BILLING_ACCESS_LABELS[status] || status}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                </div>

                {!canManageBilling ? (
                  <p className="admin-muted-copy">Seu nivel interno pode visualizar o plano e o status financeiro, mas nao alterar cobranca nem permissao sensivel.</p>
                ) : null}

                <div className="admin-inline-actions">
                  <Button disabled={saving || !canManageBilling} onClick={handleUpdatePlan}>
                    Atualizar plano
                  </Button>
                  <Button variant="secondary" disabled={saving || !canManageBilling} onClick={handleUpdateBilling}>
                    Atualizar status financeiro
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <EmptyState title="Selecione um cliente" description="Escolha um acesso na lista lateral para editar nivel, tenant vinculado, plano ou seguranca." />
          )}
        </div>
      </div>
    </div>
  );
}
