import { useEffect, useMemo, useState } from 'react';
import { PAYMENT_PROVIDERS } from '@shared/constants/index.js';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { SectionEyebrow, AdminField } from '@/components/business/editor/TenantEditorPrimitives.jsx';
import {
  createAdminBusinessAsaasSubaccount,
  fetchAdminBusinessFinanceSettings,
  fetchAdminFinanceSettings,
  updateAdminBusinessFinanceSettings,
  updateAdminFinanceSettings,
} from '@/services/adminService.js';

function buildGlobalDraft(settings = {}) {
  return {
    platformWalletId: settings.platformWalletId || '',
    defaultPlatformFeePercent: String(settings.defaultPlatformFeePercent ?? 0),
  };
}

function buildTenantDraft(settings = {}) {
  return {
    enabled: Boolean(settings.enabled),
    provider: settings.provider || PAYMENT_PROVIDERS.MANUAL,
    methods: {
      pix: Boolean(settings.methods?.pix),
      creditCard: Boolean(settings.methods?.creditCard),
      debitCard: Boolean(settings.methods?.debitCard),
      cashOnPickup: Boolean(settings.methods?.cashOnPickup),
      cashOnDelivery: Boolean(settings.methods?.cashOnDelivery),
    },
    asaas: {
      enabled: Boolean(settings.asaas?.enabled),
      walletId: settings.asaas?.walletId || '',
      accountEmail: settings.asaas?.accountEmail || '',
      accountName: settings.asaas?.accountName || '',
      status: settings.asaas?.status || 'not_connected',
      apiKey: '',
      clearApiKey: false,
    },
    split: {
      enabled: Boolean(settings.split?.enabled),
      inheritsGlobal: settings.split?.inheritsGlobal !== false,
      platformFeePercent: String(settings.split?.platformFeePercent ?? 0),
    },
  };
}

function buildSubaccountDraft(settings = {}) {
  return {
    name: settings.businessName || '',
    email: settings.asaas?.accountEmail || '',
    cpfCnpj: '',
    mobilePhone: '',
    postalCode: '',
    addressNumber: '',
    province: '',
  };
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

function parsePercentInput(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function FinanceBooleanField({ label, checked, onChange, disabled = false }) {
  return (
    <label className="admin-checkbox-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

export function AdminFinancialSettingsPanel({
  token,
  businesses = [],
  selectedBusinessId = '',
  onSelectBusiness,
}) {
  const [globalSettings, setGlobalSettings] = useState(null);
  const [globalDraft, setGlobalDraft] = useState(buildGlobalDraft());
  const [tenantSettings, setTenantSettings] = useState(null);
  const [tenantDraft, setTenantDraft] = useState(buildTenantDraft());
  const [subaccountDraft, setSubaccountDraft] = useState(buildSubaccountDraft());
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [loadingTenant, setLoadingTenant] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === selectedBusinessId) || businesses[0] || null,
    [businesses, selectedBusinessId],
  );

  useEffect(() => {
    let active = true;

    async function loadGlobalSettings() {
      if (!token) {
        return;
      }

      setLoadingGlobal(true);
      setError('');

      try {
        const nextSettings = await fetchAdminFinanceSettings(token);

        if (!active) {
          return;
        }

        setGlobalSettings(nextSettings);
        setGlobalDraft(buildGlobalDraft(nextSettings));
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (active) {
          setLoadingGlobal(false);
        }
      }
    }

    loadGlobalSettings();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;

    async function loadTenantSettings() {
      if (!token || !selectedBusiness?.id) {
        setTenantSettings(null);
        setTenantDraft(buildTenantDraft());
        setSubaccountDraft(buildSubaccountDraft());
        return;
      }

      setLoadingTenant(true);
      setError('');

      try {
        const nextSettings = await fetchAdminBusinessFinanceSettings(token, selectedBusiness.id);

        if (!active) {
          return;
        }

        setTenantSettings(nextSettings);
        setTenantDraft(buildTenantDraft(nextSettings));
        setSubaccountDraft(buildSubaccountDraft(nextSettings));
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (active) {
          setLoadingTenant(false);
        }
      }
    }

    loadTenantSettings();

    return () => {
      active = false;
    };
  }, [selectedBusiness?.id, token]);

  async function handleSaveGlobal(event) {
    event.preventDefault();
    setSavingGlobal(true);
    setMessage('');
    setError('');

    try {
      const nextSettings = await updateAdminFinanceSettings(token, {
        platformWalletId: globalDraft.platformWalletId,
        defaultPlatformFeePercent: parsePercentInput(globalDraft.defaultPlatformFeePercent),
      });

      setGlobalSettings(nextSettings);
      setGlobalDraft(buildGlobalDraft(nextSettings));
      setMessage('Configuracoes globais salvas com sucesso.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingGlobal(false);
    }
  }

  async function handleSaveTenant(event) {
    event.preventDefault();

    if (!selectedBusiness?.id) {
      return;
    }

    setSavingTenant(true);
    setMessage('');
    setError('');

    try {
      const nextSettings = await updateAdminBusinessFinanceSettings(token, selectedBusiness.id, {
        enabled: tenantDraft.enabled,
        provider: tenantDraft.provider,
        methods: tenantDraft.methods,
        asaas: {
          enabled: tenantDraft.asaas.enabled,
          walletId: tenantDraft.asaas.walletId,
          accountEmail: tenantDraft.asaas.accountEmail,
          accountName: tenantDraft.asaas.accountName,
          status: tenantDraft.asaas.status,
          apiKey: tenantDraft.asaas.apiKey,
          clearApiKey: tenantDraft.asaas.clearApiKey,
        },
        split: {
          enabled: tenantDraft.split.enabled,
          inheritsGlobal: tenantDraft.split.inheritsGlobal,
          platformFeePercent: parsePercentInput(tenantDraft.split.platformFeePercent),
        },
      });

      setTenantSettings(nextSettings);
      setTenantDraft(buildTenantDraft(nextSettings));
      setSubaccountDraft((current) => ({
        ...current,
        name: nextSettings.businessName || current.name,
        email: nextSettings.asaas?.accountEmail || current.email,
      }));
      setMessage('Configuracoes do tenant salvas com sucesso.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingTenant(false);
    }
  }

  async function handleCreateSubaccount(event) {
    event.preventDefault();

    if (!selectedBusiness?.id) {
      return;
    }

    setCreatingSubaccount(true);
    setMessage('');
    setError('');

    try {
      const nextSettings = await createAdminBusinessAsaasSubaccount(token, selectedBusiness.id, subaccountDraft);
      setTenantSettings(nextSettings);
      setTenantDraft(buildTenantDraft(nextSettings));
      setSubaccountDraft(buildSubaccountDraft(nextSettings));
      setMessage('Subconta Asaas criada e conectada ao tenant.');
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setCreatingSubaccount(false);
    }
  }

  return (
    <div className="admin-card-stack admin-card-stack--airy">
      {message ? <p className="admin-status-banner admin-status-banner--success">{message}</p> : null}
      {error ? <p className="admin-status-banner admin-status-banner--error">{error}</p> : null}

      <Card className="admin-panel-card admin-finance-panel">
        <div className="admin-panel-card__header">
          <div>
            <SectionEyebrow>Financeiro</SectionEyebrow>
            <h2>Configuracoes Financeiras</h2>
            <p>Controle a integracao do Asaas da plataforma, defina a taxa padrao do TapLink e acompanhe a conexao financeira de cada tenant.</p>
          </div>
        </div>

        {loadingGlobal ? (
          <p className="admin-muted-copy">Carregando configuracoes financeiras...</p>
        ) : (
          <form className="admin-card-stack admin-finance-panel__form" onSubmit={handleSaveGlobal}>
            <div className="admin-form-grid">
              <AdminField label="Ambiente">
                <input value={globalSettings?.environment || 'sandbox'} disabled />
              </AdminField>
              <AdminField label="Status da integracao">
                <input value={globalSettings?.integrationStatus || 'missing_api_key'} disabled />
              </AdminField>
              <AdminField label="Wallet da plataforma">
                <input
                  value={globalDraft.platformWalletId}
                  onChange={(event) =>
                    setGlobalDraft((current) => ({
                      ...current,
                      platformWalletId: event.target.value,
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Taxa padrao da plataforma (%)">
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.01"
                  value={globalDraft.defaultPlatformFeePercent}
                  onChange={(event) =>
                    setGlobalDraft((current) => ({
                      ...current,
                      defaultPlatformFeePercent: event.target.value,
                    }))
                  }
                />
              </AdminField>
            </div>

            <div className="admin-inline-note admin-inline-note--preview">
              <strong>Webhook Asaas</strong>
              <span>{globalSettings?.webhookUrl || ''}</span>
              <span>
                Conta raiz configurada: {globalSettings?.rootApiKeyConfigured ? 'sim' : 'nao'}.
              </span>
            </div>

            <div className="admin-inline-actions">
              <Button type="submit" disabled={savingGlobal}>
                {savingGlobal ? 'Salvando...' : 'Salvar configuracoes globais'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="admin-panel-card admin-finance-panel">
        <div className="admin-panel-card__header">
          <div>
            <SectionEyebrow>Tenant</SectionEyebrow>
            <h2>Integracao financeira por tenant</h2>
            <p>Crie ou conecte uma subconta Asaas, controle os metodos ativos e aplique override da taxa da plataforma quando precisar.</p>
          </div>
        </div>

        {!businesses.length ? (
          <EmptyState title="Nenhum tenant disponivel" description="Crie pelo menos um tenant para configurar pagamentos." />
        ) : (
          <>
            <div className="admin-form-grid">
              <AdminField label="Tenant financeiro">
                <select
                  value={selectedBusiness?.id || ''}
                  onChange={(event) => onSelectBusiness?.(event.target.value)}
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Subconta conectada">
                <input value={tenantSettings?.asaas?.connected ? 'Sim' : 'Nao'} disabled />
              </AdminField>
            </div>

            {loadingTenant ? (
              <p className="admin-muted-copy">Carregando configuracoes do tenant...</p>
            ) : tenantSettings ? (
              <div className="admin-card-stack admin-card-stack--airy">
                <form className="admin-card-stack admin-finance-panel__form" onSubmit={handleSaveTenant}>
                  <div className="admin-form-grid">
                    <AdminField label="Provider ativo">
                      <select
                        value={tenantDraft.provider}
                        onChange={(event) =>
                          setTenantDraft((current) => ({
                            ...current,
                            provider: event.target.value,
                          }))
                        }
                      >
                        <option value={PAYMENT_PROVIDERS.MANUAL}>Manual</option>
                        <option value={PAYMENT_PROVIDERS.ASAAS}>Asaas</option>
                      </select>
                    </AdminField>
                    <AdminField label="Status da subconta">
                      <input value={tenantSettings.asaas?.status || 'not_connected'} disabled />
                    </AdminField>
                    <AdminField label="WalletId da subconta">
                      <input
                        value={tenantDraft.asaas.walletId}
                        onChange={(event) =>
                          setTenantDraft((current) => ({
                            ...current,
                            asaas: {
                              ...current.asaas,
                              walletId: event.target.value,
                            },
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="Conta financeira">
                      <input
                        value={tenantDraft.asaas.accountEmail}
                        onChange={(event) =>
                          setTenantDraft((current) => ({
                            ...current,
                            asaas: {
                              ...current.asaas,
                              accountEmail: event.target.value,
                            },
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="Nome da conta">
                      <input
                        value={tenantDraft.asaas.accountName}
                        onChange={(event) =>
                          setTenantDraft((current) => ({
                            ...current,
                            asaas: {
                              ...current.asaas,
                              accountName: event.target.value,
                            },
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="Nova apiKey da subconta">
                      <input
                        type="password"
                        value={tenantDraft.asaas.apiKey}
                        placeholder="Cole uma apiKey nova apenas se quiser trocar"
                        onChange={(event) =>
                          setTenantDraft((current) => ({
                            ...current,
                            asaas: {
                              ...current.asaas,
                              apiKey: event.target.value,
                            },
                          }))
                        }
                      />
                    </AdminField>
                  </div>

                  <div className="admin-card-stack admin-finance-panel__toggles">
                    <FinanceBooleanField
                      label="Checkout ativo para este tenant"
                      checked={tenantDraft.enabled}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          enabled: checked,
                        }))
                      }
                    />
                    <FinanceBooleanField
                      label="Asaas ativo para este tenant"
                      checked={tenantDraft.asaas.enabled}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          asaas: {
                            ...current.asaas,
                            enabled: checked,
                          },
                        }))
                      }
                    />
                    <FinanceBooleanField
                      label="Pix ativo"
                      checked={tenantDraft.methods.pix}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          methods: {
                            ...current.methods,
                            pix: checked,
                          },
                        }))
                      }
                    />
                    <FinanceBooleanField
                      label="Cartao de credito ativo"
                      checked={tenantDraft.methods.creditCard}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          methods: {
                            ...current.methods,
                            creditCard: checked,
                          },
                        }))
                      }
                    />
                    <FinanceBooleanField
                      label="Cartao de debito ativo"
                      checked={tenantDraft.methods.debitCard}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          methods: {
                            ...current.methods,
                            debitCard: checked,
                          },
                        }))
                      }
                    />
                    <FinanceBooleanField
                      label="Pagamento na retirada"
                      checked={tenantDraft.methods.cashOnPickup}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          methods: {
                            ...current.methods,
                            cashOnPickup: checked,
                          },
                        }))
                      }
                    />
                    <FinanceBooleanField
                      label="Pagamento na entrega"
                      checked={tenantDraft.methods.cashOnDelivery}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          methods: {
                            ...current.methods,
                            cashOnDelivery: checked,
                          },
                        }))
                      }
                    />
                    <FinanceBooleanField
                      label="Aplicar split da plataforma"
                      checked={tenantDraft.split.enabled}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          split: {
                            ...current.split,
                            enabled: checked,
                          },
                        }))
                      }
                    />
                    <FinanceBooleanField
                      label="Nao herdar taxa global"
                      checked={!tenantDraft.split.inheritsGlobal}
                      onChange={(checked) =>
                        setTenantDraft((current) => ({
                          ...current,
                          split: {
                            ...current.split,
                            inheritsGlobal: !checked,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="admin-form-grid">
                    <AdminField label="Override da taxa do tenant (%)">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="0.01"
                        disabled={tenantDraft.split.inheritsGlobal}
                        value={tenantDraft.split.platformFeePercent}
                        onChange={(event) =>
                          setTenantDraft((current) => ({
                            ...current,
                            split: {
                              ...current.split,
                              platformFeePercent: event.target.value,
                            },
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="Taxa efetiva atual">
                      <input value={String(tenantSettings.split?.effectivePlatformFeePercent ?? 0)} disabled />
                    </AdminField>
                  </div>

                  <div className="admin-inline-note admin-inline-note--preview">
                    <strong>Conexao segura</strong>
                    <span>apiKey salva: {tenantSettings.asaas?.hasApiKey ? 'sim' : 'nao'}</span>
                    <span>Wallet da plataforma configurada: {tenantSettings.split?.platformWalletConfigured ? 'sim' : 'nao'}</span>
                  </div>

                  <div className="admin-inline-actions">
                    <Button type="submit" disabled={savingTenant}>
                      {savingTenant ? 'Salvando...' : 'Salvar configuracoes do tenant'}
                    </Button>
                  </div>
                </form>

                <form className="admin-card-stack admin-finance-panel__form" onSubmit={handleCreateSubaccount}>
                  <div className="admin-panel-card__header admin-panel-card__header--compact">
                    <div>
                      <h2>Criar subconta Asaas</h2>
                      <p>Use a conta raiz do TapLink para provisionar a subconta do tenant e salvar a apiKey com criptografia.</p>
                    </div>
                  </div>

                  <div className="admin-form-grid">
                    <AdminField label="Nome da conta">
                      <input
                        value={subaccountDraft.name}
                        onChange={(event) =>
                          setSubaccountDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="E-mail da conta">
                      <input
                        value={subaccountDraft.email}
                        onChange={(event) =>
                          setSubaccountDraft((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="CPF ou CNPJ">
                      <input
                        value={subaccountDraft.cpfCnpj}
                        onChange={(event) =>
                          setSubaccountDraft((current) => ({
                            ...current,
                            cpfCnpj: event.target.value,
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="Celular">
                      <input
                        value={subaccountDraft.mobilePhone}
                        onChange={(event) =>
                          setSubaccountDraft((current) => ({
                            ...current,
                            mobilePhone: event.target.value,
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="CEP">
                      <input
                        value={subaccountDraft.postalCode}
                        onChange={(event) =>
                          setSubaccountDraft((current) => ({
                            ...current,
                            postalCode: event.target.value,
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="Numero">
                      <input
                        value={subaccountDraft.addressNumber}
                        onChange={(event) =>
                          setSubaccountDraft((current) => ({
                            ...current,
                            addressNumber: event.target.value,
                          }))
                        }
                      />
                    </AdminField>
                    <AdminField label="Bairro / provincia">
                      <input
                        value={subaccountDraft.province}
                        onChange={(event) =>
                          setSubaccountDraft((current) => ({
                            ...current,
                            province: event.target.value,
                          }))
                        }
                      />
                    </AdminField>
                  </div>

                  <div className="admin-inline-actions">
                    <Button type="submit" disabled={creatingSubaccount}>
                      {creatingSubaccount ? 'Criando subconta...' : 'Criar subconta'}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <p className="admin-muted-copy">Selecione um tenant para revisar a integracao financeira.</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
