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
  testAdminAsaasConnection,
  updateAdminBusinessFinanceSettings,
  updateAdminFinanceSettings,
} from '@/services/adminService.js';

const PROVIDER_LABELS = {
  [PAYMENT_PROVIDERS.MANUAL]: 'Manual',
  [PAYMENT_PROVIDERS.ASAAS]: 'Asaas',
};

const INTEGRATION_LABELS = {
  missing_api_key: 'API ausente',
  configured: 'Configurado',
  connected: 'Conectado',
  invalid_credentials: 'Credenciais invalidas',
  webhook_error: 'Webhook com erro',
};

const TENANT_FINANCIAL_LABELS = {
  not_connected: 'Nao conectada',
  pending: 'Pendente',
  under_review: 'Em analise',
  reviewing: 'Em analise',
  active: 'Ativo',
  rejected: 'Rejeitada',
  blocked: 'Bloqueada',
  inactive: 'Inativa',
  suspended: 'Suspensa',
};

const ASAAS_COMPANY_TYPE_OPTIONS = [
  { value: 'MEI', label: 'MEI' },
  { value: 'LIMITED', label: 'Sociedade limitada' },
  { value: 'INDIVIDUAL', label: 'Empresario individual' },
  { value: 'ASSOCIATION', label: 'Associacao' },
];

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
      status: settings.asaas?.status || settings.tenantFinancialStatus || 'not_connected',
      apiKey: '',
      clearApiKey: false,
    },
    split: {
      enabled: Boolean(settings.split?.enabled),
      inheritsGlobal: settings.usesGlobalFee ?? settings.split?.inheritsGlobal !== false,
      platformFeePercent: String(
        settings.splitPreview?.tenantOverridePercent ?? settings.split?.platformFeePercent ?? 0,
      ),
    },
  };
}

function buildSubaccountDraft(settings = {}) {
  return {
    name: settings.businessName || '',
    email: settings.asaas?.accountEmail || '',
    cpfCnpj: settings.asaas?.document || '',
    companyType: settings.asaas?.companyType || '',
    incomeValue: settings.asaas?.incomeValue ? String(settings.asaas.incomeValue) : '',
    phone: settings.asaas?.phone || '',
    mobilePhone: settings.asaas?.mobilePhone || '',
    site: settings.asaas?.site || '',
    address: settings.asaas?.address || '',
    addressNumber: settings.asaas?.addressNumber || '',
    complement: settings.asaas?.complement || '',
    province: settings.asaas?.province || '',
    postalCode: settings.asaas?.postalCode || '',
  };
}

function getErrorMessage(error) {
  if (error?.code === 'SUBACCOUNT_PROVIDER_ERROR' && error?.message) {
    return error.message;
  }

  if (Array.isArray(error?.details) && error.details.length) {
    return error.details
      .filter((detail) => detail?.message)
      .map((detail) => {
        const path = detail.path || detail.field;
        return path ? `${path}: ${detail.message}` : detail.message;
      })
      .join(' | ');
  }

  return error?.message || 'Nao foi possivel concluir esta operacao.';
}

function extractFieldErrors(error) {
  const fieldErrors = {};

  if (error?.field) {
    fieldErrors[error.field] = error.message;
  }

  if (Array.isArray(error?.details)) {
    error.details.forEach((detail) => {
      const field = detail?.field || detail?.path;
      if (field && detail?.message) {
        fieldErrors[field] = detail.message;
      }
    });
  }

  return fieldErrors;
}

function parsePercentInput(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizePhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('55') && [12, 13].includes(digits.length)) {
    return digits.slice(2);
  }

  return digits;
}

function formatPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '0';
  }

  return Number(numericValue.toFixed(2)).toString();
}

function isConfiguredIntegration(integrationStatus) {
  return integrationStatus === 'configured' || integrationStatus === 'connected';
}

function isWalletConfigured(value) {
  return Boolean(String(value || '').trim());
}

function humanizeIntegrationStatus(status) {
  return INTEGRATION_LABELS[status] || 'Nao configurado';
}

function humanizeTenantFinancialStatus(status) {
  return TENANT_FINANCIAL_LABELS[status] || 'Nao conectada';
}

function getStatusTone(status) {
  if (['configured', 'connected', 'active', 'enabled', 'ready', 'platform_ready'].includes(status)) {
    return 'success';
  }

  if (['pending', 'under_review', 'reviewing', 'warning', 'manual'].includes(status)) {
    return 'warning';
  }

  if (['invalid_credentials', 'webhook_error', 'missing_api_key', 'blocked', 'rejected', 'disabled', 'inactive'].includes(status)) {
    return 'danger';
  }

  return 'neutral';
}

function validateSubaccountDraft(draft) {
  const errors = {};
  const cpfCnpjDigits = String(draft.cpfCnpj || '').replace(/\D/g, '');
  const mobilePhoneDigits = normalizePhoneDigits(draft.mobilePhone);
  const phoneDigits = normalizePhoneDigits(draft.phone);
  const postalCodeDigits = String(draft.postalCode || '').replace(/\D/g, '');
  const incomeValue = parsePercentInput(draft.incomeValue);

  if (!String(draft.name || '').trim()) {
    errors.name = 'Informe o nome da conta.';
  }

  if (!cpfCnpjDigits) {
    errors.cpfCnpj = 'Informe o CNPJ da subconta Asaas.';
  } else if (cpfCnpjDigits.length === 11) {
    errors.cpfCnpj = 'Use CNPJ para criar subconta Asaas neste fluxo.';
  } else if (cpfCnpjDigits.length !== 14) {
    errors.cpfCnpj = 'Informe um CNPJ valido com 14 digitos.';
  }

  if (!draft.companyType) {
    errors.companyType = 'Selecione o tipo de empresa.';
  }

  if (!incomeValue || incomeValue <= 0) {
    errors.incomeValue = 'Informe o faturamento mensal.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(draft.email || '').trim())) {
    errors.email = 'Informe um e-mail valido.';
  }

  if (mobilePhoneDigits.length < 10 || mobilePhoneDigits.length > 11) {
    errors.mobilePhone = 'Informe um celular valido.';
  }

  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
    errors.phone = 'Informe um telefone valido.';
  }

  if (!String(draft.address || '').trim()) {
    errors.address = 'Informe o logradouro.';
  }

  if (!String(draft.addressNumber || '').trim()) {
    errors.addressNumber = 'Informe o numero.';
  }

  if (!String(draft.province || '').trim()) {
    errors.province = 'Informe o bairro.';
  }

  if (postalCodeDigits.length !== 8) {
    errors.postalCode = 'Informe um CEP valido.';
  }

  return errors;
}

function getSubaccountFeedback({ status, error, tenantHasSubaccount }) {
  if (tenantHasSubaccount) {
    return 'Subconta ja vinculada a este tenant. Revise as configuracoes financeiras antes de criar outra.';
  }

  if (status === 'loading') {
    return 'Criando subconta Asaas...';
  }

  if (status === 'success') {
    return 'Subconta Asaas criada e vinculada com sucesso.';
  }

  if (status === 'error') {
    return error || 'Revise os dados destacados antes de tentar novamente.';
  }

  return 'Pronto para provisionar a subconta.';
}

function hasSensitiveTenantChanges(draft, settings) {
  const currentWalletId = settings?.asaas?.walletId || '';
  const currentProvider = settings?.provider || PAYMENT_PROVIDERS.MANUAL;

  return (
    String(draft.asaas.walletId || '').trim() !== String(currentWalletId || '').trim() ||
    Boolean(String(draft.asaas.apiKey || '').trim()) ||
    Boolean(draft.asaas.clearApiKey) ||
    draft.provider !== currentProvider
  );
}

function maskInlineValue(value) {
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return '••••••••';
  }

  return `${value.slice(0, 6)}••••${value.slice(-4)}`;
}

function deriveTenantViewState({ globalSettings, globalDraft, tenantDraft, tenantSettings }) {
  const integrationStatus = globalSettings?.integrationStatus || tenantSettings?.integrationStatus || 'missing_api_key';
  const provider = tenantDraft.provider || tenantSettings?.provider || PAYMENT_PROVIDERS.MANUAL;
  const isAsaasProvider = provider === PAYMENT_PROVIDERS.ASAAS;
  const usesGlobalFee = tenantDraft.split.inheritsGlobal !== false;
  const globalPercent = parsePercentInput(globalSettings?.defaultPlatformFeePercent ?? globalDraft.defaultPlatformFeePercent);
  const tenantOverridePercent = usesGlobalFee ? null : parsePercentInput(tenantDraft.split.platformFeePercent);
  const effectivePlatformFeePercent = usesGlobalFee ? globalPercent : tenantOverridePercent;
  const splitActive = Boolean(tenantDraft.split.enabled);
  const platformWalletConfigured = isWalletConfigured(globalSettings?.platformWalletId || globalDraft.platformWalletId);
  const tenantWalletConfigured = isWalletConfigured(tenantDraft.asaas.walletId);
  const tenantFinancialStatus = tenantDraft.asaas.status || tenantSettings?.tenantFinancialStatus || 'not_connected';
  const integrationValid = isConfiguredIntegration(integrationStatus);
  const canEnableSplit = !splitActive || (platformWalletConfigured && tenantWalletConfigured);
  const canEnableCheckout =
    !isAsaasProvider ||
    (integrationValid &&
      tenantFinancialStatus === 'active' &&
      tenantWalletConfigured &&
      (!splitActive || canEnableSplit));
  const warnings = [];

  if (isAsaasProvider && !integrationValid) {
    warnings.push('A integracao global do Asaas precisa estar configurada antes de ativar este tenant.');
  }

  if (splitActive && !platformWalletConfigured) {
    warnings.push('Configure a wallet da plataforma antes de aplicar o split.');
  }

  if (splitActive && !tenantWalletConfigured) {
    warnings.push('A subconta precisa ter walletId valido antes de aplicar o split.');
  }

  if (isAsaasProvider && tenantFinancialStatus !== 'active') {
    warnings.push('Checkout online com Asaas exige subconta ativa.');
  }

  const splitPreview = {
    globalPercent,
    tenantOverridePercent,
    effectivePlatformFeePercent,
    platformPercent: splitActive ? effectivePlatformFeePercent : 0,
    tenantNetPercent: splitActive ? Math.max(0, 100 - effectivePlatformFeePercent) : 100,
    inheritsGlobal: usesGlobalFee,
    splitActive,
    mode: usesGlobalFee ? 'global' : 'custom',
  };

  const summary = {
    providerLabel: PROVIDER_LABELS[provider] || 'Manual',
    integrationLabel: humanizeIntegrationStatus(integrationStatus),
    tenantFinancialLabel: humanizeTenantFinancialStatus(tenantFinancialStatus),
    splitLabel: splitActive ? 'Ativo' : 'Desativado',
    checkoutLabel: tenantDraft.enabled ? 'Ativo' : 'Desativado',
  };

  return {
    integrationStatus,
    integrationValid,
    provider,
    tenantFinancialStatus,
    splitPreview,
    usesGlobalFee,
    effectivePlatformFeePercent,
    canEnableSplit,
    canEnableCheckout,
    warnings,
    summary,
    platformWalletConfigured,
    tenantWalletConfigured,
  };
}

function FinanceBooleanField({ label, checked, onChange, disabled = false }) {
  return (
    <label className="admin-checkbox-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function FinanceStatusBadge({ label, tone = 'neutral' }) {
  return (
    <span className={`admin-finance-status-badge admin-finance-status-badge--${tone}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

function FinanceSection({ eyebrow, title, description, children, actions = null }) {
  return (
    <section className="admin-finance-section">
      <header className="admin-finance-section__header">
        <div>
          {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="admin-finance-section__actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

function FinanceSummaryCard({ viewState, globalSettings }) {
  const checkoutTone = viewState.canEnableCheckout && viewState.summary.checkoutLabel === 'Ativo' ? 'success' : 'neutral';
  const splitTone = viewState.splitPreview.splitActive ? (viewState.canEnableSplit ? 'success' : 'warning') : 'neutral';
  const webhookTone = globalSettings?.summary?.platformReady ? 'success' : 'warning';

  return (
    <section className="admin-finance-summary-card">
      <header className="admin-finance-summary-card__header">
        <div>
          <SectionEyebrow>Operacao</SectionEyebrow>
          <h3>Status financeiro do tenant</h3>
          <p>Resumo operacional rapido para decidir se este tenant ja esta pronto para operar pagamentos com split.</p>
        </div>
      </header>

      <div className="admin-finance-summary-grid">
        <div className="admin-finance-summary-item">
          <span>Provider</span>
          <strong>{viewState.summary.providerLabel}</strong>
        </div>
        <div className="admin-finance-summary-item">
          <span>Subconta</span>
          <FinanceStatusBadge
            label={viewState.summary.tenantFinancialLabel}
            tone={getStatusTone(viewState.tenantFinancialStatus)}
          />
        </div>
        <div className="admin-finance-summary-item">
          <span>Split</span>
          <FinanceStatusBadge label={viewState.summary.splitLabel} tone={splitTone} />
        </div>
        <div className="admin-finance-summary-item">
          <span>Taxa efetiva</span>
          <strong>{formatPercent(viewState.effectivePlatformFeePercent)}%</strong>
        </div>
        <div className="admin-finance-summary-item">
          <span>Checkout online</span>
          <FinanceStatusBadge label={viewState.summary.checkoutLabel} tone={checkoutTone} />
        </div>
        <div className="admin-finance-summary-item">
          <span>Webhook</span>
          <FinanceStatusBadge
            label={globalSettings?.summary?.platformReady ? 'Funcionando' : 'Revisar'}
            tone={webhookTone}
          />
        </div>
      </div>
    </section>
  );
}

function FinanceSplitPreview({ viewState }) {
  const { splitPreview } = viewState;

  return (
    <section className="admin-finance-preview-card">
      <div className="admin-finance-preview-card__header">
        <div>
          <strong>Preview do split</strong>
          <span>
            {splitPreview.inheritsGlobal
              ? 'Este tenant esta usando a taxa global da plataforma.'
              : 'Este tenant possui taxa customizada.'}
          </span>
        </div>
        <FinanceStatusBadge
          label={splitPreview.splitActive ? 'Split ativo' : 'Split desativado'}
          tone={splitPreview.splitActive ? 'success' : 'neutral'}
        />
      </div>

      <div className="admin-finance-preview-grid">
        <div className="admin-finance-preview-item">
          <span>Taxa global</span>
          <strong>{formatPercent(splitPreview.globalPercent)}%</strong>
        </div>
        <div className="admin-finance-preview-item">
          <span>Override do tenant</span>
          <strong>{splitPreview.tenantOverridePercent == null ? 'Herdando' : `${formatPercent(splitPreview.tenantOverridePercent)}%`}</strong>
        </div>
        <div className="admin-finance-preview-item">
          <span>Taxa efetiva</span>
          <strong>{formatPercent(splitPreview.effectivePlatformFeePercent)}%</strong>
        </div>
        <div className="admin-finance-preview-item">
          <span>Modo</span>
          <strong>{splitPreview.mode === 'global' ? 'Global' : 'Customizado'}</strong>
        </div>
      </div>

      <div className="admin-finance-preview-totals">
        <p>TapLink recebe: {formatPercent(splitPreview.platformPercent)}%</p>
        <p>Tenant recebe: {formatPercent(splitPreview.tenantNetPercent)}%</p>
      </div>
    </section>
  );
}

function SensitiveField({
  label,
  value,
  revealed,
  onToggleReveal,
  onCopy,
  onChange,
  placeholder = '',
  helperText = '',
}) {
  return (
    <AdminField label={label}>
      <div className="admin-finance-sensitive-field">
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
        />
        <div className="admin-finance-sensitive-field__actions">
          <Button type="button" variant="secondary" className="admin-finance-inline-button" onClick={onToggleReveal}>
            {revealed ? 'Ocultar' : 'Mostrar'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="admin-finance-inline-button"
            disabled={!value}
            onClick={onCopy}
          >
            Copiar
          </Button>
        </div>
        {helperText ? <span className="admin-finance-help-text">{helperText}</span> : null}
      </div>
    </AdminField>
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
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);
  const [subaccountStatus, setSubaccountStatus] = useState('idle');
  const [subaccountError, setSubaccountError] = useState('');
  const [subaccountFieldErrors, setSubaccountFieldErrors] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPlatformWallet, setShowPlatformWallet] = useState(false);
  const [showTenantWallet, setShowTenantWallet] = useState(false);
  const [showSubaccountApiKey, setShowSubaccountApiKey] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === selectedBusinessId) || businesses[0] || null,
    [businesses, selectedBusinessId],
  );

  const tenantViewState = useMemo(
    () =>
      deriveTenantViewState({
        globalSettings,
        globalDraft,
        tenantDraft,
        tenantSettings,
      }),
    [globalDraft, globalSettings, tenantDraft, tenantSettings],
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
        setSubaccountStatus('idle');
        setSubaccountError('');
        setSubaccountFieldErrors({});
        setShowAdvanced(false);
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
        setSubaccountStatus('idle');
        setSubaccountError('');
        setSubaccountFieldErrors({});
        setShowTenantWallet(false);
        setShowSubaccountApiKey(false);
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

  function handleCopy(value) {
    if (!value || !navigator?.clipboard?.writeText) {
      return;
    }

    navigator.clipboard.writeText(value).catch(() => {});
    setMessage('Valor copiado para a area de transferencia.');
  }

  function updateSubaccountDraftField(field, value) {
    setSubaccountDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setSubaccountFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
    setSubaccountError('');
  }

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

  async function handleTestConnection() {
    setTestingConnection(true);
    setMessage('');
    setError('');

    try {
      const result = await testAdminAsaasConnection(token);
      setConnectionResult(result);
      setMessage(result?.message || 'Conexao com Asaas validada com sucesso.');
    } catch (testError) {
      setConnectionResult(null);
      setError(getErrorMessage(testError));
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSaveTenant(event) {
    event.preventDefault();

    if (!selectedBusiness?.id) {
      return;
    }

    if (hasSensitiveTenantChanges(tenantDraft, tenantSettings)) {
      const confirmed = window.confirm('Alterar credenciais financeiras pode impactar pagamentos deste tenant.');
      if (!confirmed) {
        return;
      }
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

    const validationErrors = validateSubaccountDraft(subaccountDraft);
    if (Object.keys(validationErrors).length) {
      const validationMessage = 'Revise os campos obrigatorios para criar a subconta Asaas.';
      setSubaccountFieldErrors(validationErrors);
      setSubaccountError(validationMessage);
      setSubaccountStatus('error');
      setError(Object.values(validationErrors).join(' | '));
      return;
    }

    setCreatingSubaccount(true);
    setSubaccountStatus('loading');
    setSubaccountError('');
    setSubaccountFieldErrors({});
    setMessage('');
    setError('');

    try {
      const nextSettings = await createAdminBusinessAsaasSubaccount(token, selectedBusiness.id, subaccountDraft);
      setTenantSettings(nextSettings);
      setTenantDraft(buildTenantDraft(nextSettings));
      setSubaccountDraft(buildSubaccountDraft(nextSettings));
      setSubaccountStatus('success');
      setMessage(
        `Subconta Asaas criada e conectada ao tenant. Wallet ${nextSettings.asaas?.walletId || ''} com status ${humanizeTenantFinancialStatus(nextSettings.tenantFinancialStatus || nextSettings.asaas?.status)}.`,
      );
    } catch (createError) {
      const nextFieldErrors = extractFieldErrors(createError);
      const nextErrorMessage = getErrorMessage(createError);
      setSubaccountFieldErrors(nextFieldErrors);
      setSubaccountError(nextErrorMessage);
      setSubaccountStatus('error');
      setError(nextErrorMessage);
    } finally {
      setCreatingSubaccount(false);
    }
  }

  const platformReady = Boolean(globalSettings?.summary?.platformReady);
  const tenantHasSubaccount = Boolean(
    tenantSettings?.asaas?.connected || tenantSettings?.asaas?.walletId || tenantSettings?.asaas?.subaccountId,
  );
  const subaccountFeedback = getSubaccountFeedback({
    status: subaccountStatus,
    error: subaccountError,
    tenantHasSubaccount,
  });

  return (
    <div className="admin-card-stack admin-card-stack--airy">
      {message ? <p className="admin-status-banner admin-status-banner--success">{message}</p> : null}
      {error ? <p className="admin-status-banner admin-status-banner--error">{error}</p> : null}

      <Card className="admin-panel-card admin-finance-panel">
        <div className="admin-panel-card__header">
          <div>
            <SectionEyebrow>Financeiro</SectionEyebrow>
            <h2>Configuracoes Financeiras</h2>
            <p>
              Operacao interna do TapLink para configurar integracao global, split da plataforma, checkout online e subcontas
              Asaas dos tenants.
            </p>
          </div>
        </div>

        {loadingGlobal ? (
          <p className="admin-muted-copy">Carregando configuracoes financeiras...</p>
        ) : (
          <form className="admin-card-stack admin-finance-panel__form" onSubmit={handleSaveGlobal}>
            <FinanceSection
              eyebrow="Plataforma"
              title="Configuracao Global da Plataforma"
              description="Defina o ambiente do Asaas, valide a integracao raiz e ajuste a taxa padrao da plataforma."
            >
              <div className="admin-form-grid">
                <AdminField label="Ambiente">
                  <input value={globalSettings?.environment || 'sandbox'} disabled />
                </AdminField>
                <AdminField label="Status da integracao">
                  <div className="admin-finance-field-stack">
                    <FinanceStatusBadge
                      label={humanizeIntegrationStatus(globalSettings?.integrationStatus || 'missing_api_key')}
                      tone={getStatusTone(globalSettings?.integrationStatus || 'missing_api_key')}
                    />
                  </div>
                </AdminField>
                <SensitiveField
                  label="Wallet da plataforma"
                  value={globalDraft.platformWalletId}
                  revealed={showPlatformWallet}
                  onToggleReveal={() => setShowPlatformWallet((current) => !current)}
                  onCopy={() => handleCopy(globalDraft.platformWalletId)}
                  onChange={(event) =>
                    setGlobalDraft((current) => ({
                      ...current,
                      platformWalletId: event.target.value,
                    }))
                  }
                  helperText={globalDraft.platformWalletId ? `Preview mascarada: ${maskInlineValue(globalDraft.platformWalletId)}` : ''}
                />
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

              <div className="admin-finance-summary-grid admin-finance-summary-grid--platform">
                <div className="admin-finance-summary-item">
                  <span>Webhook Asaas</span>
                  <strong>{globalSettings?.webhookUrl || '-'}</strong>
                </div>
                <div className="admin-finance-summary-item">
                  <span>Status da conta raiz</span>
                  <FinanceStatusBadge label={platformReady ? 'Ativa' : 'Revisar'} tone={platformReady ? 'success' : 'warning'} />
                </div>
                <div className="admin-finance-summary-item">
                  <span>API raiz</span>
                  <FinanceStatusBadge
                    label={globalSettings?.rootApiKeyConfigured ? 'Configurada' : 'Ausente'}
                    tone={globalSettings?.rootApiKeyConfigured ? 'success' : 'danger'}
                  />
                </div>
              </div>

              {connectionResult ? (
                <div className="admin-inline-note admin-inline-note--preview">
                  <strong>Ultimo teste de conexao</strong>
                  <span>
                    {connectionResult.ok ? 'Conectado' : 'Nao configurado'} - {connectionResult.environment || globalSettings?.environment || 'sandbox'}
                  </span>
                  <span>{connectionResult.message || 'Resultado validado sem expor credenciais.'}</span>
                </div>
              ) : null}

              <div className="admin-inline-actions">
                <Button type="button" variant="secondary" disabled={testingConnection} onClick={handleTestConnection}>
                  {testingConnection ? 'Testando...' : 'Testar conexao Asaas'}
                </Button>
                <Button type="submit" disabled={savingGlobal}>
                  {savingGlobal ? 'Salvando...' : 'Salvar configuracoes globais'}
                </Button>
              </div>
            </FinanceSection>
          </form>
        )}
      </Card>

      <Card className="admin-panel-card admin-finance-panel">
        <div className="admin-panel-card__header">
          <div>
            <SectionEyebrow>Tenant</SectionEyebrow>
            <h2>Operacao financeira por tenant</h2>
            <p>Controle provider, split, checkout online e o provisionamento da subconta financeira do tenant selecionado.</p>
          </div>
        </div>

        {!businesses.length ? (
          <EmptyState title="Nenhum tenant disponivel" description="Crie pelo menos um tenant para configurar pagamentos." />
        ) : (
          <>
            <div className="admin-form-grid">
              <AdminField label="Tenant selecionado">
                <select value={selectedBusiness?.id || ''} onChange={(event) => onSelectBusiness?.(event.target.value)}>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Subconta conectada">
                <div className="admin-finance-field-stack">
                  <FinanceStatusBadge
                    label={tenantSettings?.asaas?.connected ? 'Ativa' : 'Nao conectada'}
                    tone={tenantSettings?.asaas?.connected ? 'success' : 'neutral'}
                  />
                </div>
              </AdminField>
            </div>

            {loadingTenant ? (
              <p className="admin-muted-copy">Carregando configuracoes do tenant...</p>
            ) : tenantSettings ? (
              <div className="admin-card-stack admin-card-stack--airy">
                <FinanceSummaryCard viewState={tenantViewState} globalSettings={globalSettings} />

                {tenantViewState.warnings.length ? (
                  <div className="admin-finance-warning-list">
                    {tenantViewState.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}

                <form className="admin-card-stack admin-finance-panel__form" onSubmit={handleSaveTenant}>
                  <FinanceSection
                    eyebrow="Tenant"
                    title="Configuracao Financeira do Tenant"
                    description="Ajuste provider, status da subconta, metodos de pagamento, split e checkout online para este tenant."
                  >
                    <div className="admin-form-grid">
                      <AdminField label="Provider ativo">
                        <select
                          value={tenantDraft.provider}
                          onChange={(event) =>
                            setTenantDraft((current) => ({
                              ...current,
                              provider: event.target.value,
                              split:
                                event.target.value === PAYMENT_PROVIDERS.ASAAS && !current.split.enabled
                                  ? {
                                      ...current.split,
                                      enabled: true,
                                    }
                                  : current.split,
                            }))
                          }
                        >
                          <option value={PAYMENT_PROVIDERS.MANUAL}>Manual</option>
                          <option value={PAYMENT_PROVIDERS.ASAAS}>Asaas</option>
                        </select>
                      </AdminField>
                      <AdminField label="Status financeiro da subconta">
                        <div className="admin-finance-field-stack">
                          <FinanceStatusBadge
                            label={tenantViewState.summary.tenantFinancialLabel}
                            tone={getStatusTone(tenantViewState.tenantFinancialStatus)}
                          />
                        </div>
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
                    </div>

                    <div className="admin-card-stack admin-finance-panel__toggles">
                      <FinanceBooleanField
                        label="Checkout online ativo para este tenant"
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
                    </div>

                    <div className="admin-card-stack admin-finance-config-card">
                      <div className="admin-finance-config-card__header">
                        <div>
                          <strong>Configuracao de split</strong>
                          <span>Use a taxa global da plataforma por padrao ou defina uma taxa customizada para este tenant.</span>
                        </div>
                        <FinanceStatusBadge
                          label={tenantViewState.canEnableSplit ? 'Split pronto' : 'Revisar split'}
                          tone={tenantViewState.canEnableSplit ? 'success' : 'warning'}
                        />
                      </div>

                      <div className="admin-card-stack admin-finance-panel__toggles">
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
                          <input value={formatPercent(tenantViewState.effectivePlatformFeePercent)} disabled />
                        </AdminField>
                      </div>

                      <FinanceSplitPreview viewState={tenantViewState} />
                    </div>

                    <div className="admin-inline-actions admin-inline-actions--between">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowAdvanced((current) => !current)}
                      >
                        {showAdvanced ? 'Ocultar configuracoes avancadas' : 'Mostrar configuracoes avancadas'}
                      </Button>
                    </div>

                    {showAdvanced ? (
                      <div className="admin-card-stack admin-finance-advanced-card">
                        <div className="admin-finance-advanced-card__header">
                          <div>
                            <strong>Configuracoes avancadas</strong>
                            <span>Alterar credenciais financeiras pode impactar pagamentos deste tenant.</span>
                          </div>
                        </div>

                        <div className="admin-form-grid">
                          <SensitiveField
                            label="WalletId da subconta"
                            value={tenantDraft.asaas.walletId}
                            revealed={showTenantWallet}
                            onToggleReveal={() => setShowTenantWallet((current) => !current)}
                            onCopy={() => handleCopy(tenantDraft.asaas.walletId)}
                            onChange={(event) =>
                              setTenantDraft((current) => ({
                                ...current,
                                asaas: {
                                  ...current.asaas,
                                  walletId: event.target.value,
                                },
                              }))
                            }
                            helperText={
                              tenantDraft.asaas.walletId ? `Preview mascarada: ${maskInlineValue(tenantDraft.asaas.walletId)}` : ''
                            }
                          />
                          <SensitiveField
                            label="Nova apiKey da subconta"
                            value={tenantDraft.asaas.apiKey}
                            revealed={showSubaccountApiKey}
                            onToggleReveal={() => setShowSubaccountApiKey((current) => !current)}
                            onCopy={() => handleCopy(tenantDraft.asaas.apiKey)}
                            onChange={(event) =>
                              setTenantDraft((current) => ({
                                ...current,
                                asaas: {
                                  ...current.asaas,
                                  apiKey: event.target.value,
                                },
                              }))
                            }
                            placeholder="Cole uma apiKey nova apenas se quiser trocar"
                            helperText="A apiKey da subconta nunca deve ser exposta em mensagens de erro."
                          />
                          <AdminField label="Status da subconta">
                            <select
                              value={tenantDraft.asaas.status}
                              onChange={(event) =>
                                setTenantDraft((current) => ({
                                  ...current,
                                  asaas: {
                                    ...current.asaas,
                                    status: event.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="not_connected">Nao conectada</option>
                              <option value="pending">Pendente</option>
                              <option value="under_review">Em analise</option>
                              <option value="active">Ativa</option>
                              <option value="rejected">Rejeitada</option>
                              <option value="blocked">Bloqueada</option>
                            </select>
                          </AdminField>
                          <AdminField label="Limpeza de credenciais">
                            <div className="admin-finance-field-stack">
                              <FinanceBooleanField
                                label="Remover apiKey criptografada atual"
                                checked={tenantDraft.asaas.clearApiKey}
                                onChange={(checked) =>
                                  setTenantDraft((current) => ({
                                    ...current,
                                    asaas: {
                                      ...current.asaas,
                                      clearApiKey: checked,
                                    },
                                  }))
                                }
                              />
                            </div>
                          </AdminField>
                        </div>
                      </div>
                    ) : null}

                    <div className="admin-inline-actions">
                      <Button type="submit" disabled={savingTenant}>
                        {savingTenant ? 'Salvando...' : 'Salvar configuracoes do tenant'}
                      </Button>
                    </div>
                  </FinanceSection>
                </form>

                <form className="admin-card-stack admin-finance-panel__form" onSubmit={handleCreateSubaccount}>
                  <FinanceSection
                    eyebrow="Provisionamento"
                    title="Criar Subconta Asaas"
                    description="Provisiona uma subconta usando a conta raiz do TapLink e vincula o walletId retornado ao tenant sem precisar atualizar a pagina."
                  >
                    <div className="admin-card-stack admin-finance-config-card">
                      <div className="admin-finance-config-card__header">
                        <div>
                          <strong>Dados da conta</strong>
                          <span>Use os dados cadastrais do CNPJ que sera vinculado ao Asaas.</span>
                        </div>
                      </div>

                      <div className="admin-form-grid">
                        <AdminField label="Nome da conta" error={subaccountFieldErrors.name}>
                          <input
                            value={subaccountDraft.name}
                            aria-invalid={Boolean(subaccountFieldErrors.name)}
                            onChange={(event) => updateSubaccountDraftField('name', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="CNPJ" error={subaccountFieldErrors.cpfCnpj}>
                          <input
                            value={subaccountDraft.cpfCnpj}
                            inputMode="numeric"
                            aria-invalid={Boolean(subaccountFieldErrors.cpfCnpj)}
                            onChange={(event) => updateSubaccountDraftField('cpfCnpj', event.target.value)}
                          />
                        </AdminField>
                        <AdminField
                          label="Tipo de empresa"
                          description="Valor enviado como companyType para o Asaas."
                          error={subaccountFieldErrors.companyType}
                        >
                          <select
                            value={subaccountDraft.companyType}
                            aria-invalid={Boolean(subaccountFieldErrors.companyType)}
                            onChange={(event) => updateSubaccountDraftField('companyType', event.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {ASAAS_COMPANY_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Faturamento mensal" error={subaccountFieldErrors.incomeValue}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={subaccountDraft.incomeValue}
                            aria-invalid={Boolean(subaccountFieldErrors.incomeValue)}
                            onChange={(event) => updateSubaccountDraftField('incomeValue', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="E-mail da conta" error={subaccountFieldErrors.email}>
                          <input
                            value={subaccountDraft.email}
                            aria-invalid={Boolean(subaccountFieldErrors.email)}
                            onChange={(event) => updateSubaccountDraftField('email', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="Celular" error={subaccountFieldErrors.mobilePhone}>
                          <input
                            value={subaccountDraft.mobilePhone}
                            inputMode="tel"
                            aria-invalid={Boolean(subaccountFieldErrors.mobilePhone)}
                            onChange={(event) => updateSubaccountDraftField('mobilePhone', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="Telefone fixo" error={subaccountFieldErrors.phone}>
                          <input
                            value={subaccountDraft.phone}
                            inputMode="tel"
                            aria-invalid={Boolean(subaccountFieldErrors.phone)}
                            onChange={(event) => updateSubaccountDraftField('phone', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="Site" error={subaccountFieldErrors.site}>
                          <input
                            value={subaccountDraft.site}
                            placeholder="https://..."
                            aria-invalid={Boolean(subaccountFieldErrors.site)}
                            onChange={(event) => updateSubaccountDraftField('site', event.target.value)}
                          />
                        </AdminField>
                      </div>
                    </div>

                    <div className="admin-card-stack admin-finance-config-card">
                      <div className="admin-finance-config-card__header">
                        <div>
                          <strong>Endereco</strong>
                          <span>O CEP precisa ser valido para o Asaas resolver a cidade da subconta.</span>
                        </div>
                      </div>

                      <div className="admin-form-grid">
                        <AdminField label="CEP" error={subaccountFieldErrors.postalCode}>
                          <input
                            value={subaccountDraft.postalCode}
                            inputMode="numeric"
                            aria-invalid={Boolean(subaccountFieldErrors.postalCode)}
                            onChange={(event) => updateSubaccountDraftField('postalCode', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="Logradouro" error={subaccountFieldErrors.address}>
                          <input
                            value={subaccountDraft.address}
                            aria-invalid={Boolean(subaccountFieldErrors.address)}
                            onChange={(event) => updateSubaccountDraftField('address', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="Numero" error={subaccountFieldErrors.addressNumber}>
                          <input
                            value={subaccountDraft.addressNumber}
                            aria-invalid={Boolean(subaccountFieldErrors.addressNumber)}
                            onChange={(event) => updateSubaccountDraftField('addressNumber', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="Complemento">
                          <input
                            value={subaccountDraft.complement}
                            onChange={(event) => updateSubaccountDraftField('complement', event.target.value)}
                          />
                        </AdminField>
                        <AdminField label="Bairro / provincia" error={subaccountFieldErrors.province}>
                          <input
                            value={subaccountDraft.province}
                            aria-invalid={Boolean(subaccountFieldErrors.province)}
                            onChange={(event) => updateSubaccountDraftField('province', event.target.value)}
                          />
                        </AdminField>
                      </div>
                    </div>

                    <div className="admin-inline-note admin-inline-note--preview">
                      <strong>Feedback operacional</strong>
                      <span>{subaccountFeedback}</span>
                      <span>O retorno atualiza walletId, status financeiro, summary e warnings sem exigir F5.</span>
                    </div>

                    <div className="admin-inline-actions">
                      <Button type="submit" disabled={creatingSubaccount || tenantHasSubaccount}>
                        {creatingSubaccount ? 'Criando subconta...' : tenantHasSubaccount ? 'Subconta ja vinculada' : 'Criar subconta'}
                      </Button>
                    </div>
                  </FinanceSection>
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
