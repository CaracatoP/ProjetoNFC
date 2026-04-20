import { useEffect, useId, useMemo, useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { resolveMediaUrl } from '@/utils/formatters.js';

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function hexToRgb(value) {
  const hex = String(value || '').trim().replace('#', '');

  if (!/^[\da-fA-F]{6}$/.test(hex)) {
    return null;
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function hexToRgba(value, alpha) {
  const rgb = hexToRgb(value);

  if (!rgb) {
    return value;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function mixHexColors(base, mixWith, weight) {
  const first = hexToRgb(base);
  const second = hexToRgb(mixWith);

  if (!first || !second) {
    return base;
  }

  const mixChannel = (channel) =>
    Math.round(first[channel] * (1 - weight) + second[channel] * weight)
      .toString(16)
      .padStart(2, '0');

  return `#${mixChannel('r')}${mixChannel('g')}${mixChannel('b')}`;
}

function getReadableTextColor(background) {
  const rgb = hexToRgb(background);

  if (!rgb) {
    return '#ffffff';
  }

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.58 ? '#1a120f' : '#ffffff';
}

function buildDerivedTheme(theme, overrides) {
  const palette = {
    primary: overrides.primary || theme.colors?.primary || '#f97316',
    secondary: overrides.secondary || theme.colors?.secondary || '#fb7185',
    background: overrides.background || theme.colors?.background || '#140d09',
    text: overrides.text || theme.colors?.text || '#fff8f2',
  };

  const elevatedSurface = mixHexColors(palette.background, '#ffffff', 0.08);
  const alternateSurface = mixHexColors(palette.background, '#ffffff', 0.16);

  return {
    ...theme,
    colors: {
      ...theme.colors,
      primary: palette.primary,
      secondary: palette.secondary,
      background: palette.background,
      surface: hexToRgba(elevatedSurface, 0.92),
      surfaceAlt: hexToRgba(alternateSurface, 0.86),
      text: palette.text,
      textMuted: hexToRgba(palette.text, 0.74),
      border: hexToRgba(palette.text, 0.12),
      accent: hexToRgba(palette.primary, 0.18),
      success: theme.colors?.success || '#22c55e',
      danger: theme.colors?.danger || '#ef4444',
    },
    buttons: {
      ...theme.buttons,
      primary: {
        ...(theme.buttons?.primary || {}),
        background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
        color: getReadableTextColor(mixHexColors(palette.primary, palette.secondary, 0.5)),
        border: 'none',
      },
      secondary: {
        ...(theme.buttons?.secondary || {}),
        background: hexToRgba(palette.text, 0.06),
        color: palette.text,
        border: `1px solid ${hexToRgba(palette.text, 0.12)}`,
      },
    },
  };
}

function isHexColor(value) {
  return /^#([\da-fA-F]{6}|[\da-fA-F]{3})$/.test(String(value || '').trim());
}

function normalizeHexColor(value, fallback = '#000000') {
  const trimmed = String(value || '').trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

  if (!isHexColor(withHash)) {
    return fallback;
  }

  if (withHash.length === 4) {
    return `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`.toLowerCase();
  }

  return withHash.toLowerCase();
}

function slugify(value, { preserveTrailingSeparator = false } = {}) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '');

  return preserveTrailingSeparator ? normalized : normalized.replace(/-+$/g, '');
}

function normalizeOptionalHost(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');

  return normalized || '';
}

function getEnvironmentOrigin(fallbackUrl = '') {
  const browserOrigin = typeof window !== 'undefined' ? String(window.location.origin || '').replace(/\/$/, '') : '';

  if (browserOrigin) {
    return browserOrigin;
  }

  try {
    return new URL(fallbackUrl).origin;
  } catch {
    return '';
  }
}

function buildSubdomainPreviewUrl(subdomain, fallbackUrl = '') {
  const normalizedSubdomain = slugify(subdomain);

  if (!normalizedSubdomain) {
    return '';
  }

  const baseOrigin = getEnvironmentOrigin(fallbackUrl);

  try {
    const baseUrl = new URL(baseOrigin || fallbackUrl);
    return `${baseUrl.protocol}//${normalizedSubdomain}.${baseUrl.host}`;
  } catch {
    return `https://${normalizedSubdomain}.seu-dominio.com`;
  }
}

function buildTenantPublicUrlPreview(business = {}, fallbackUrl = '') {
  const slug = slugify(business.slug);
  const customDomain = normalizeOptionalHost(business.domains?.customDomain);
  const subdomain = slugify(business.domains?.subdomain);
  const origin = getEnvironmentOrigin(fallbackUrl);
  const slugUrl = slug && origin ? `${origin}/site/${slug}` : slug ? `/site/${slug}` : '';
  const subdomainUrl = buildSubdomainPreviewUrl(subdomain, fallbackUrl);

  return {
    slugUrl,
    subdomainUrl,
    customDomainUrl: customDomain ? `https://${customDomain}` : '',
    preferredUrl: customDomain ? `https://${customDomain}` : subdomainUrl || slugUrl || fallbackUrl || '',
  };
}

function ensureSection(draft, key, fallbackType = 'custom') {
  const existing = draft.sections.find((section) => section.key === key);

  if (existing) {
    return existing;
  }

  const nextSection = {
    id: key,
    key,
    type: fallbackType,
    title: '',
    description: '',
    order: draft.sections.length + 1,
    visible: false,
    variant: '',
    settings: {},
    items: [],
  };

  draft.sections = [...draft.sections, nextSection];
  return nextSection;
}

function updateSectionDraft(draft, key, fallbackType, updater) {
  const section = ensureSection(draft, key, fallbackType);
  updater(section);
}

function newLinkItem() {
  return {
    id: `link-${Date.now()}`,
    type: 'external',
    group: 'primary',
    label: '',
    subtitle: '',
    icon: 'default',
    url: '',
    value: '',
    visible: true,
    order: Date.now(),
    target: '_blank',
    metadata: {},
  };
}

function newServiceItem() {
  return {
    id: `service-${Date.now()}`,
    name: '',
    description: '',
    price: 0,
    ctaLabel: 'Gerar QR PIX',
  };
}

function newGalleryItem() {
  return {
    id: `gallery-${Date.now()}`,
    imageUrl: '',
    imagePublicId: '',
    alt: '',
  };
}

const SECTION_LABELS = {
  'hero-main': 'Hero principal',
  'quick-actions': 'Acesso rapido',
  services: 'Servicos',
  contact: 'Contato e atendimento',
  gallery: 'Galeria',
  about: 'Sobre nos',
  pix: 'Pagamento PIX',
  cta: 'Assinatura do criador',
};

const SECTION_TYPE_LABELS = {
  hero: 'Hero',
  links: 'Links e atalhos',
  services: 'Servicos',
  contact: 'Contato',
  gallery: 'Galeria',
  custom: 'Conteudo livre',
  pix: 'PIX',
  cta: 'Footer promocional',
};

const HIDDEN_ADMIN_SECTION_KEYS = new Set(['wifi', 'social']);

const ANALYTICS_EVENT_LABELS = {
  page_view: 'Visualizacao de pagina',
  link_click: 'Clique em atalho',
  copy_action: 'Copia de acao',
  cta_click: 'Clique em CTA',
  modal_open: 'Abertura de modal',
};

const EDITOR_STEPS = [
  { id: 'basic', label: 'Basic Info', description: 'Identidade, contato e operacao.' },
  { id: 'visual', label: 'Visual', description: 'Logo, banner e favicon.' },
  { id: 'content', label: 'Content', description: 'Servicos, galeria e texto principal.' },
  { id: 'links', label: 'Links', description: 'Acessos rapidos e atalhos.' },
  { id: 'seo', label: 'SEO / Advanced', description: 'SEO, secoes, assinatura, historico e analytics.' },
];

const customDomainPattern = /^(?!:\/\/)(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function humanizeToken(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getSectionDisplayLabel(section) {
  return SECTION_LABELS[section.key] || section.title || humanizeToken(section.key);
}

function getSectionTypeLabel(section) {
  return SECTION_TYPE_LABELS[section.type] || humanizeToken(section.type);
}

function getAnalyticsEventLabel(eventType) {
  return ANALYTICS_EVENT_LABELS[eventType] || humanizeToken(eventType);
}

function formatAnalyticsTimestamp(value) {
  if (!value) {
    return 'Sem registro';
  }

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function getAnalyticsTargetSummary(event) {
  const pieces = [
    event.targetLabel || '',
    event.sectionType ? `Secao ${humanizeToken(event.sectionType)}` : '',
    event.targetType ? `Alvo ${humanizeToken(event.targetType)}` : '',
  ].filter(Boolean);

  return pieces.join(' • ') || 'Sem alvo detalhado';
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D+/g, '').slice(0, 13);
}

function formatWhatsappValue(value) {
  const digits = normalizePhoneDigits(value);

  if (!digits) {
    return '';
  }

  const hasCountryCode = digits.startsWith('55') && digits.length > 11;
  const countryCode = hasCountryCode ? digits.slice(0, 2) : '';
  const localDigits = hasCountryCode ? digits.slice(2) : digits;
  const areaCode = localDigits.slice(0, 2);
  const prefixLength = localDigits.length > 10 ? 5 : 4;
  const prefix = localDigits.slice(2, 2 + prefixLength);
  const suffix = localDigits.slice(2 + prefixLength, 2 + prefixLength + 4);

  return [
    countryCode ? `+${countryCode}` : '',
    areaCode ? `(${areaCode})` : '',
    prefix,
    suffix ? `-${suffix}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(' -', '-');
}

function isValidHttpUrl(value) {
  if (!String(value || '').trim()) {
    return true;
  }

  try {
    const url = new URL(String(value).trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isValidLinkUrl(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return true;
  }

  if (normalized.startsWith('mailto:') || normalized.startsWith('tel:')) {
    return true;
  }

  return isValidHttpUrl(normalized);
}

function formatHistoryValue(value) {
  if (value === undefined || value === null || value === '') {
    return 'vazio';
  }

  if (typeof value === 'string') {
    return value.length > 72 ? `${value.slice(0, 69)}...` : value;
  }

  const serialized = JSON.stringify(value);
  return serialized.length > 72 ? `${serialized.slice(0, 69)}...` : serialized;
}

function getFieldStep(path) {
  if (path.startsWith('business.logoUrl') || path.startsWith('business.bannerUrl') || path.startsWith('business.seo.imageUrl')) {
    return 'visual';
  }

  if (path.startsWith('links.') || path.includes('primaryAction.href')) {
    return 'links';
  }

  if (path.startsWith('sections.gallery') || path.startsWith('theme.') || path.startsWith('sections.services')) {
    return 'content';
  }

  if (path.startsWith('business.seo.') || path.startsWith('history.')) {
    return 'seo';
  }

  return 'basic';
}

function buildValidationErrors(draft) {
  const errors = {};
  const whatsappDigits = normalizePhoneDigits(draft.business.contact?.whatsapp);
  const ctaLink = draft.sections.find((section) => section.key === 'cta')?.settings?.primaryAction?.href;

  if (!String(draft.business.name || '').trim()) {
    errors['business.name'] = 'Nome do comercio e obrigatorio.';
  }

  if (!slugify(draft.business.slug)) {
    errors['business.slug'] = 'Slug obrigatorio, em minusculas e sem espacos.';
  }

  if (whatsappDigits && (whatsappDigits.length < 10 || whatsappDigits.length > 13)) {
    errors['business.contact.whatsapp'] = 'Informe um WhatsApp valido com DDI e numero.';
  }

  if (draft.business.domains?.customDomain && !customDomainPattern.test(draft.business.domains.customDomain)) {
    errors['business.domains.customDomain'] = 'Informe um dominio customizado valido.';
  }

  [
    ['business.logoUrl', draft.business.logoUrl, 'Logo'],
    ['business.bannerUrl', draft.business.bannerUrl, 'Banner'],
    ['business.seo.imageUrl', draft.business.seo?.imageUrl, 'Icone do site'],
    ['cta.primaryAction.href', ctaLink, 'Link da assinatura'],
  ].forEach(([path, value, label]) => {
    if (value && !isValidHttpUrl(value)) {
      errors[path] = `${label} precisa ser uma URL valida.`;
    }
  });

  draft.links.forEach((link, index) => {
    if (link.url && !isValidLinkUrl(link.url)) {
      errors[`links.${index}.url`] = 'Use uma URL valida para este atalho.';
    }
  });

  draft.sections
    .filter((section) => section.key === 'gallery')
    .forEach((section) => {
      (section.items || []).forEach((item, index) => {
        if (item.imageUrl && !isValidHttpUrl(item.imageUrl)) {
          errors[`sections.gallery.${index}.imageUrl`] = 'A imagem da galeria precisa ser uma URL valida.';
        }
      });
    });

  return errors;
}

function getInputState(error) {
  return {
    className: error ? 'admin-input--invalid' : '',
    'aria-invalid': Boolean(error),
  };
}

function AdminField({ label, children, description, error }) {
  return (
    <label className={`admin-field ${error ? 'admin-field--invalid' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="admin-field__error">{error}</small> : null}
      {description ? <small>{description}</small> : null}
    </label>
  );
}

function SensitiveInput({ label, value, onChange, placeholder, error }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <AdminField label={label} error={error}>
      <div className="admin-sensitive-input">
        <input
          type={revealed ? 'text' : 'password'}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          {...getInputState(error)}
        />
        <button type="button" className="admin-sensitive-toggle" onClick={() => setRevealed((current) => !current)}>
          {revealed ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </AdminField>
  );
}

function ThemeColorField({ label, value, fallback, onChange }) {
  const pickerId = useId();
  const normalizedValue = normalizeHexColor(value, fallback);
  const [textValue, setTextValue] = useState(normalizedValue);

  useEffect(() => {
    setTextValue(normalizedValue);
  }, [normalizedValue]);

  function commit(nextValue) {
    const committed = normalizeHexColor(nextValue, normalizedValue);
    setTextValue(committed);
    onChange?.(committed);
  }

  return (
    <AdminField label={label} description="Use um valor hexadecimal, por exemplo #f97316.">
      <div className="admin-color-control">
        <input
          aria-label={label}
          value={textValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setTextValue(nextValue);

            const candidate = nextValue.startsWith('#') ? nextValue : `#${nextValue}`;
            if (isHexColor(candidate)) {
              onChange?.(normalizeHexColor(nextValue, normalizedValue));
            }
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(textValue);
            }
          }}
          placeholder={fallback}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
        />
        <button
          type="button"
          className="admin-color-swatch"
          aria-label={`Selecionar ${label}`}
          style={{ background: normalizedValue }}
          onClick={() => document.getElementById(pickerId)?.click()}
        />
        <input
          id={pickerId}
          type="color"
          className="admin-color-picker"
          value={normalizedValue}
          onChange={(event) => commit(event.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </AdminField>
  );
}

function PreviewImage({ src, alt }) {
  const resolvedSrc = resolveMediaUrl(src);

  if (!resolvedSrc) {
    return <div className="admin-image-preview admin-image-preview--empty">Sem imagem</div>;
  }

  return (
    <div className="admin-image-preview">
      <img src={resolvedSrc} alt={alt} />
    </div>
  );
}

async function uploadImageAndPatch(file, onUpload, options, onDone) {
  if (!file || !onUpload) {
    return;
  }

  const upload = await onUpload(file, options);
  onDone(upload);
}

export function TenantEditorPanel({
  editor,
  saving,
  deleting,
  togglingStatus,
  duplicating,
  onSave,
  onDelete,
  onUpload,
  onToggleStatus,
  onDuplicate,
  onCopyPublicLink,
}) {
  const [draft, setDraft] = useState(editor ? cloneDeep(editor) : null);
  const [uploadingField, setUploadingField] = useState('');
  const [activeStep, setActiveStep] = useState('basic');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setDraft(editor ? cloneDeep(editor) : null);
    setActiveStep('basic');
    setLocalError('');
  }, [editor]);

  const analyticsSummary = useMemo(() => draft?.analytics || null, [draft]);
  const validationErrors = useMemo(() => (draft ? buildValidationErrors(draft) : {}), [draft]);
  const hasBlockingErrors = Object.keys(validationErrors).length > 0;
  const activeStepIndex = EDITOR_STEPS.findIndex((step) => step.id === activeStep);

  useEffect(() => {
    if (!hasBlockingErrors && localError) {
      setLocalError('');
    }
  }, [hasBlockingErrors, localError]);

  if (!draft) {
    return (
      <Card className="admin-panel-card">
        <EmptyState
          title="Nenhum tenant selecionado"
          description="Escolha um comercio na coluna lateral para editar conteudo, branding, links e analytics."
        />
      </Card>
    );
  }

  const servicesSection = draft.sections.find((section) => section.key === 'services');
  const gallerySection = draft.sections.find((section) => section.key === 'gallery');
  const aboutSection = draft.sections.find((section) => section.key === 'about');
  const ctaSection = draft.sections.find((section) => section.key === 'cta');
  const analyticsByEventType = analyticsSummary?.byEventType || [];
  const recentAnalyticsEvents = analyticsSummary?.recentEvents || [];
  const maxAnalyticsEventCount = Math.max(1, ...analyticsByEventType.map((item) => item.count || 0));
  const latestAnalyticsEvent = recentAnalyticsEvents[0] || null;
  const isActive = draft.business.status === 'active';
  const publicUrlPreview = buildTenantPublicUrlPreview(draft.business, editor?.business?.publicUrl);
  const historyEntries = draft.history || [];

  const handleSave = async () => {
    if (hasBlockingErrors) {
      const [firstInvalidPath] = Object.keys(validationErrors);
      setActiveStep(getFieldStep(firstInvalidPath));
      setLocalError('Corrija os campos destacados antes de salvar.');
      return;
    }

    setLocalError('');
    await onSave?.(draft);
  };

  return (
    <div className="admin-editor-stack">
      <Card className="admin-panel-card admin-panel-card--hero">
        <div className="admin-editor-header">
          <div>
            <h2>{draft.business.name}</h2>
            <p>{publicUrlPreview.preferredUrl || `/site/${draft.business.slug}`}</p>
            <div className="admin-editor-meta">
              <span className="admin-meta-pill">Status: {draft.business.status}</span>
              <span className="admin-meta-pill">Tag: {draft.nfcTag?.code || 'Sem codigo NFC'}</span>
              <span className="admin-meta-pill">Eventos: {analyticsSummary?.totalEvents || 0}</span>
            </div>
          </div>
          <div className="admin-toolbar">
            <div className="admin-toolbar__group">
              <Button variant="secondary" onClick={onCopyPublicLink} disabled={!publicUrlPreview.preferredUrl}>
                Copiar link
              </Button>
              <Button variant="secondary" onClick={onDuplicate} disabled={duplicating || deleting || saving}>
                {duplicating ? 'Duplicando...' : 'Duplicar tenant'}
              </Button>
            </div>
            <div className="admin-toolbar__group admin-toolbar__group--end">
              <Button
                variant="secondary"
                onClick={() => onToggleStatus?.(draft.business.id, isActive ? 'inactive' : 'active')}
                disabled={togglingStatus || deleting || saving || duplicating}
              >
                {togglingStatus ? (isActive ? 'Inativando...' : 'Ativando...') : isActive ? 'Inativar site' : 'Ativar site'}
              </Button>
              <Button
                variant="secondary"
                className="button--danger-tone"
                onClick={() => onDelete?.(draft.business.id)}
                disabled={deleting || duplicating}
              >
                {deleting ? 'Excluindo...' : 'Excluir tenant'}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alteracoes'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="admin-panel-card admin-panel-card--controls">
        <div className="admin-card-stack admin-card-stack--airy">
          <div className="admin-panel-card__header">
            <div>
              <h2>Fluxo do editor</h2>
              <p>Navegue por etapas para ajustar o tenant com mais foco e menos densidade visual.</p>
            </div>
            <span className="admin-section-chip admin-section-chip--accent">
              Etapa {activeStepIndex + 1} de {EDITOR_STEPS.length}
            </span>
          </div>

          <div className="admin-stepper">
            {EDITOR_STEPS.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={`admin-stepper__item ${activeStep === step.id ? 'admin-stepper__item--active' : ''}`}
                aria-label={step.label}
                aria-current={activeStep === step.id ? 'step' : undefined}
                title={step.label}
                onClick={() => setActiveStep(step.id)}
              >
                <span className="admin-stepper__index">{index + 1}</span>
                <span className="admin-stepper__copy">
                  <strong>{step.label}</strong>
                  <small>{step.description}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="admin-stepper-footer">
            <div className="admin-inline-note">
              <strong>{EDITOR_STEPS[activeStepIndex]?.label}</strong>
              <span>{EDITOR_STEPS[activeStepIndex]?.description}</span>
            </div>
            <div className="admin-inline-actions">
              <Button variant="secondary" disabled={activeStepIndex <= 0} onClick={() => setActiveStep(EDITOR_STEPS[Math.max(0, activeStepIndex - 1)].id)}>
                Voltar
              </Button>
              <Button
                variant="secondary"
                disabled={activeStepIndex >= EDITOR_STEPS.length - 1}
                onClick={() => setActiveStep(EDITOR_STEPS[Math.min(EDITOR_STEPS.length - 1, activeStepIndex + 1)].id)}
              >
                Proxima etapa
              </Button>
            </div>
          </div>

          {localError ? <p className="admin-status-banner admin-status-banner--error">{localError}</p> : null}
        </div>
      </Card>

      <div className="admin-editor-grid">
        {activeStep === 'basic' ? (
          <>
        <Card id="tenant-identity" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Identidade do tenant</h2>
              <p>Dados basicos, slug, status e apresentacao da pagina.</p>
            </div>
          </div>

          <div className="admin-card-stack admin-card-stack--airy">
          <div className="admin-form-grid">
            <AdminField label="Nome do comercio" error={validationErrors['business.name']}>
              <input
                value={draft.business.name}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, name: event.target.value },
                }))}
                {...getInputState(validationErrors['business.name'])}
              />
            </AdminField>
            <AdminField label="Slug publico" error={validationErrors['business.slug']}>
              <input
                value={draft.business.slug}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, slug: slugify(event.target.value, { preserveTrailingSeparator: true }) },
                }))}
                onBlur={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, slug: slugify(event.target.value) },
                }))}
                {...getInputState(validationErrors['business.slug'])}
              />
            </AdminField>
            <AdminField label="Status">
              <select
                value={draft.business.status}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, status: event.target.value },
                }))}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </AdminField>
            <AdminField
              label="Subdominio do cliente"
              description="Opcional. Exemplo: studio-exemplo gera um preview como studio-exemplo.seu-dominio.com."
            >
              <input
                value={draft.business.domains?.subdomain || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    domains: {
                      ...(current.business.domains || {}),
                      subdomain: slugify(event.target.value, { preserveTrailingSeparator: true }),
                    },
                  },
                }))}
                onBlur={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    domains: {
                      ...(current.business.domains || {}),
                      subdomain: slugify(event.target.value),
                    },
                  },
                }))}
                placeholder="studio-exemplo"
              />
            </AdminField>
            <AdminField
              label="Dominio customizado"
              description="Opcional. Informe apenas o host, por exemplo cliente.com.br."
              error={validationErrors['business.domains.customDomain']}
            >
              <input
                value={draft.business.domains?.customDomain || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    domains: {
                      ...(current.business.domains || {}),
                      customDomain: normalizeOptionalHost(event.target.value),
                    },
                  },
                }))}
                placeholder="cliente.com.br"
                {...getInputState(validationErrors['business.domains.customDomain'])}
              />
            </AdminField>
            <AdminField label="Badge">
              <input
                value={draft.business.badge || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, badge: event.target.value },
                }))}
              />
            </AdminField>
            <AdminField label="Avaliacao">
              <input
                value={draft.business.rating || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, rating: event.target.value },
                }))}
              />
            </AdminField>
            <SensitiveInput
              label="Codigo da tag NFC"
              value={draft.nfcTag?.code || ''}
              onChange={(event) => setDraft((current) => ({
                ...current,
                nfcTag: { ...(current.nfcTag || {}), code: event.target.value, status: current.nfcTag?.status || 'active' },
              }))}
              placeholder="Codigo interno da tag"
            />
          </div>

          <AdminField label="Descricao principal">
            <textarea
              rows="4"
              value={draft.business.description || ''}
              onChange={(event) => setDraft((current) => ({
                ...current,
                business: { ...current.business, description: event.target.value },
              }))}
            />
          </AdminField>

          <div className="admin-inline-note">
            <strong>URL publica</strong>
            <span>{publicUrlPreview.preferredUrl || 'Preencha slug, subdominio ou dominio customizado para gerar uma URL publica.'}</span>
          </div>

          <div className="admin-domain-preview-grid">
            <div className="admin-domain-preview-card">
              <strong>Slug atual</strong>
              <span>{publicUrlPreview.slugUrl || 'Ainda nao definido'}</span>
            </div>
            <div className="admin-domain-preview-card">
              <strong>Preview por subdominio</strong>
              <span>{publicUrlPreview.subdomainUrl || 'Nenhum subdominio configurado'}</span>
            </div>
            <div className="admin-domain-preview-card">
              <strong>Preview por dominio</strong>
              <span>{publicUrlPreview.customDomainUrl || 'Nenhum dominio customizado configurado'}</span>
            </div>
          </div>
          </div>
        </Card>

          </>
        ) : null}

        {activeStep === 'visual' ? (
        <Card id="tenant-media" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Logo, banner e uploads</h2>
              <p>Suba logo, icone do site e banner com upload centralizado no Cloudinary e persistencia segura por tenant.</p>
            </div>
          </div>

          <div className="admin-card-stack">
          <div className="admin-media-grid admin-media-grid--assets">
            <div className="admin-media-card">
              <PreviewImage src={draft.business.logoUrl} alt={draft.business.name} />
              <AdminField label="Logo URL" error={validationErrors['business.logoUrl']}>
                <input
                  value={draft.business.logoUrl || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      logoUrl: event.target.value,
                      logoPublicId: '',
                    },
                  }))}
                  {...getInputState(validationErrors['business.logoUrl'])}
                />
              </AdminField>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingField('logo');
                  await uploadImageAndPatch(file, onUpload, {
                    tenantSlug: draft.business.slug,
                    assetType: 'logo',
                  }, (upload) =>
                    setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        logoUrl: upload.url,
                        logoPublicId: upload.publicId || '',
                      },
                    })),
                  );
                  setUploadingField('');
                }}
              />
              {uploadingField === 'logo' ? <small>Enviando logo...</small> : null}
            </div>

            <div className="admin-media-card">
              <PreviewImage src={draft.business.seo?.imageUrl} alt={`Icone ${draft.business.name}`} />
              <AdminField
                label="Icone do site"
                description="Usado como icone da aba do navegador e identidade curta do site."
                error={validationErrors['business.seo.imageUrl']}
              >
                <input
                  value={draft.business.seo?.imageUrl || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      seo: {
                        ...current.business.seo,
                        imageUrl: event.target.value,
                        imagePublicId: '',
                      },
                    },
                  }))}
                  {...getInputState(validationErrors['business.seo.imageUrl'])}
                />
              </AdminField>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingField('site-icon');
                  await uploadImageAndPatch(file, onUpload, {
                    tenantSlug: draft.business.slug,
                    assetType: 'site-icon',
                  }, (upload) =>
                    setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        seo: {
                          ...current.business.seo,
                          imageUrl: upload.url,
                          imagePublicId: upload.publicId || '',
                        },
                      },
                    })),
                  );
                  setUploadingField('');
                }}
              />
              {uploadingField === 'site-icon' ? <small>Enviando icone...</small> : null}
            </div>

            <div className="admin-media-card">
              <PreviewImage src={draft.business.bannerUrl} alt={draft.business.name} />
              <AdminField label="Banner URL" error={validationErrors['business.bannerUrl']}>
                <input
                  value={draft.business.bannerUrl || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      bannerUrl: event.target.value,
                      bannerPublicId: '',
                    },
                  }))}
                  {...getInputState(validationErrors['business.bannerUrl'])}
                />
              </AdminField>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingField('banner');
                  await uploadImageAndPatch(file, onUpload, {
                    tenantSlug: draft.business.slug,
                    assetType: 'banner',
                  }, (upload) =>
                    setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        bannerUrl: upload.url,
                        bannerPublicId: upload.publicId || '',
                      },
                    })),
                  );
                  setUploadingField('');
                }}
              />
              {uploadingField === 'banner' ? <small>Enviando banner...</small> : null}
            </div>
          </div>
          </div>
        </Card>
        ) : null}

        {activeStep === 'basic' ? (
          <>
        <Card id="tenant-contact" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Contato e atendimento</h2>
              <p>Canais principais, endereco e horario resumido do tenant.</p>
            </div>
          </div>

          <div className="admin-card-stack">
          <div className="admin-form-grid">
            <AdminField label="WhatsApp" error={validationErrors['business.contact.whatsapp']}>
              <input
                value={formatWhatsappValue(draft.business.contact?.whatsapp || '')}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: { ...current.business.contact, whatsapp: normalizePhoneDigits(event.target.value) },
                  },
                }))}
                placeholder="+55 (11) 99999-9999"
                {...getInputState(validationErrors['business.contact.whatsapp'])}
              />
            </AdminField>
            <AdminField label="Telefone">
              <input
                value={draft.business.contact?.phone || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: { ...current.business.contact, phone: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="E-mail">
              <input
                value={draft.business.contact?.email || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: { ...current.business.contact, email: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Endereco">
              <input
                value={draft.business.address?.display || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    address: { ...current.business.address, display: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Horario principal" description="Use o bloco de horarios do editor para detalhar mais linhas.">
              <input
                value={draft.business.hours?.[0]?.value || ''}
                onChange={(event) => setDraft((current) => {
                  const hours = current.business.hours?.length ? [...current.business.hours] : [{ id: 'weekday', label: 'Horario', value: '' }];
                  hours[0] = { ...hours[0], value: event.target.value };
                  return {
                    ...current,
                    business: { ...current.business, hours },
                  };
                })}
              />
            </AdminField>
          </div>
          </div>
        </Card>

        <Card id="tenant-payments" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Pagamentos</h2>
              <p>Configure o PIX do site principal e o Wi-Fi usado no atalho rapido.</p>
            </div>
          </div>

          <div className="admin-card-stack">
          <div className="admin-split-grid admin-split-grid--payments">
            <div className="admin-subpanel admin-subpanel--payment">
              <h3>PIX</h3>
              <div className="admin-form-grid">
                <AdminField label="Tipo de chave">
                  <select
                    value={draft.business.contact?.pix?.keyType || ''}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...current.business.contact,
                          pix: { ...(current.business.contact?.pix || {}), keyType: event.target.value },
                        },
                      },
                    }))}
                  >
                    <option value="">Selecione</option>
                    <option value="cpf">cpf</option>
                    <option value="cnpj">cnpj</option>
                    <option value="email">email</option>
                    <option value="telefone">telefone</option>
                    <option value="aleatoria">aleatoria</option>
                  </select>
                </AdminField>
                <SensitiveInput
                  label="Chave PIX"
                  value={draft.business.contact?.pix?.key || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      contact: {
                        ...current.business.contact,
                        pix: { ...(current.business.contact?.pix || {}), key: event.target.value },
                      },
                    },
                  }))}
                  placeholder="Chave PIX do recebedor"
                />
                <AdminField label="Recebedor">
                  <input
                    value={draft.business.contact?.pix?.receiverName || ''}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...current.business.contact,
                          pix: { ...(current.business.contact?.pix || {}), receiverName: event.target.value },
                        },
                      },
                    }))}
                  />
                </AdminField>
              </div>
            </div>

            <div className="admin-subpanel admin-subpanel--payment">
              <h3>Wi-Fi do atalho rapido</h3>
              <div className="admin-form-grid">
                <AdminField label="SSID">
                  <input
                    value={draft.business.contact?.wifi?.ssid || ''}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...current.business.contact,
                          wifi: { ...(current.business.contact?.wifi || {}), ssid: event.target.value },
                        },
                      },
                    }))}
                  />
                </AdminField>
                <SensitiveInput
                  label="Senha"
                  value={draft.business.contact?.wifi?.password || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      contact: {
                        ...current.business.contact,
                        wifi: { ...(current.business.contact?.wifi || {}), password: event.target.value },
                      },
                    },
                  }))}
                  placeholder="Senha do Wi-Fi"
                />
              </div>
            </div>
          </div>
          </div>
        </Card>
          </>
        ) : null}

        {activeStep === 'links' ? (
        <Card id="tenant-links" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Links e atalhos</h2>
              <p>Edite os botoes de acesso rapido e outros links agrupados do tenant.</p>
            </div>
            <Button variant="secondary" onClick={() => setDraft((current) => ({ ...current, links: [...current.links, newLinkItem()] }))}>
              Adicionar link
            </Button>
          </div>

          <div className="admin-card-stack">
          <div className="admin-repeater-list">
            {draft.links.map((link, index) => (
              <div key={link.id || index} className="admin-repeater-card">
                <div className="admin-form-grid">
                  <AdminField label="Label">
                    <input
                      value={link.label || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], label: event.target.value };
                        return { ...current, links };
                      })}
                    />
                  </AdminField>
                  <AdminField label="Subtitulo">
                    <input
                      value={link.subtitle || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], subtitle: event.target.value };
                        return { ...current, links };
                      })}
                    />
                  </AdminField>
                  <AdminField label="Tipo">
                    <select
                      value={link.type}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], type: event.target.value };
                        return { ...current, links };
                      })}
                    >
                      <option value="external">link externo</option>
                      <option value="contact">contato</option>
                      <option value="social">instagram / social</option>
                      <option value="wifi">wi-fi</option>
                      <option value="pix">pix</option>
                    </select>
                  </AdminField>
                  <AdminField label="Icone">
                    <input
                      value={link.icon || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], icon: event.target.value };
                        return { ...current, links };
                      })}
                    />
                  </AdminField>
                  <AdminField label="URL" error={validationErrors[`links.${index}.url`]}>
                    <input
                      value={link.url || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], url: event.target.value };
                        return { ...current, links };
                      })}
                      {...getInputState(validationErrors[`links.${index}.url`])}
                    />
                  </AdminField>
                  <AdminField label="Acao interna">
                    <input
                      value={link.metadata?.action || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = {
                          ...links[index],
                          metadata: { ...(links[index].metadata || {}), action: event.target.value },
                        };
                        return { ...current, links };
                      })}
                    />
                  </AdminField>
                </div>
                <div className="admin-inline-actions">
                  <Button
                    variant="secondary"
                    className="button--danger-tone"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      links: current.links.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </Card>
        ) : null}

        {activeStep === 'content' ? (
        <Card id="tenant-services-gallery" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Servicos e galeria</h2>
              <p>Conteudo principal da pagina publica do negocio.</p>
            </div>
          </div>

          <div className="admin-card-stack admin-card-stack--airy">
          <section className="admin-form-block admin-form-block--soft">
          <div className="admin-visibility-toggle">
            <label>
              <input
                type="checkbox"
                checked={servicesSection?.visible !== false}
                onChange={(event) => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                    section.visible = event.target.checked;
                  });
                  return nextDraft;
                })}
              />
              Exibir secao de servicos
            </label>
            <Button
              variant="secondary"
              onClick={() => setDraft((current) => {
                const nextDraft = cloneDeep(current);
                updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                  section.items = [...(section.items || []), newServiceItem()];
                });
                return nextDraft;
              })}
            >
              Adicionar servico
            </Button>
          </div>

          <div className="admin-repeater-list">
            {(servicesSection?.items || []).map((service, index) => (
              <div key={service.id || index} className="admin-repeater-card admin-repeater-card--service">
                <div className="admin-form-grid">
                  <AdminField label="Nome">
                    <input
                      value={service.name || ''}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                          section.items[index] = { ...section.items[index], name: event.target.value };
                        });
                        return nextDraft;
                      })}
                    />
                  </AdminField>
                  <AdminField label="Preco">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={service.price ?? 0}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                          section.items[index] = { ...section.items[index], price: Number(event.target.value) };
                        });
                        return nextDraft;
                      })}
                    />
                  </AdminField>
                </div>
                <AdminField label="Descricao">
                  <textarea
                    rows="3"
                    value={service.description || ''}
                    onChange={(event) => setDraft((current) => {
                      const nextDraft = cloneDeep(current);
                      updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                        section.items[index] = { ...section.items[index], description: event.target.value };
                      });
                      return nextDraft;
                    })}
                  />
                </AdminField>
                <div className="admin-inline-actions">
                  <Button
                    variant="secondary"
                    className="button--danger-tone"
                    onClick={() => setDraft((current) => {
                      const nextDraft = cloneDeep(current);
                      updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                        section.items = section.items.filter((_, itemIndex) => itemIndex !== index);
                      });
                      return nextDraft;
                    })}
                  >
                    Remover servico
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </section>

          <section className="admin-form-block admin-form-block--soft">
          <div className="admin-visibility-toggle">
            <label>
              <input
                type="checkbox"
                checked={gallerySection?.visible === true}
                onChange={(event) => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                    section.visible = event.target.checked;
                  });
                  return nextDraft;
                })}
              />
              Exibir galeria
            </label>
            <Button
              variant="secondary"
              onClick={() => setDraft((current) => {
                const nextDraft = cloneDeep(current);
                updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                  section.items = [...(section.items || []), newGalleryItem()];
                });
                return nextDraft;
              })}
            >
              Adicionar foto
            </Button>
          </div>

          <div className="admin-repeater-list">
            {(gallerySection?.items || []).map((image, index) => (
              <div key={image.id || index} className="admin-repeater-card admin-repeater-card--gallery">
                <PreviewImage src={image.imageUrl} alt={image.alt || draft.business.name} />
                <div className="admin-form-grid">
                  <AdminField label="Imagem URL" error={validationErrors[`sections.gallery.${index}.imageUrl`]}>
                    <input
                      value={image.imageUrl || ''}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                          section.items[index] = {
                            ...section.items[index],
                            imageUrl: event.target.value,
                            imagePublicId: '',
                          };
                        });
                        return nextDraft;
                      })}
                      {...getInputState(validationErrors[`sections.gallery.${index}.imageUrl`])}
                    />
                  </AdminField>
                  <AdminField label="Alt">
                    <input
                      value={image.alt || ''}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                          section.items[index] = { ...section.items[index], alt: event.target.value };
                        });
                        return nextDraft;
                      })}
                    />
                  </AdminField>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setUploadingField(`gallery-${index}`);
                    await uploadImageAndPatch(file, onUpload, {
                      tenantSlug: draft.business.slug,
                      assetType: 'gallery',
                    }, (upload) =>
                      setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                          section.items[index] = {
                            ...section.items[index],
                            imageUrl: upload.url,
                            imagePublicId: upload.publicId || '',
                          };
                        });
                        return nextDraft;
                      }),
                    );
                    setUploadingField('');
                  }}
                />
                {uploadingField === `gallery-${index}` ? <small>Enviando foto...</small> : null}
                <div className="admin-inline-actions">
                  <Button
                    variant="secondary"
                    className="button--danger-tone"
                    onClick={() => setDraft((current) => {
                      const nextDraft = cloneDeep(current);
                      updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                        section.items = section.items.filter((_, itemIndex) => itemIndex !== index);
                      });
                      return nextDraft;
                    })}
                  >
                    Remover foto
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </section>
          </div>
        </Card>
        ) : null}

        {activeStep === 'seo' ? (
          <>
        <Card id="tenant-content" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <h2>Conteudo, SEO e secoes</h2>
              <p>Controle visibilidade, mensagem institucional e cores do tenant.</p>
            </div>
          </div>

          <div className="admin-card-stack admin-card-stack--airy">
          <AdminField label="Texto Sobre nos">
            <textarea
              rows="4"
              value={aboutSection?.items?.[0]?.body || ''}
              onChange={(event) => setDraft((current) => {
                const nextDraft = cloneDeep(current);
                updateSectionDraft(nextDraft, 'about', 'custom', (section) => {
                  section.visible = Boolean(event.target.value);
                  section.description = '';
                  section.items = [{ id: 'about-1', body: event.target.value }];
                });
                return nextDraft;
              })}
            />
          </AdminField>

          <div className="admin-form-grid">
            <AdminField label="SEO title">
              <input
                value={draft.business.seo?.title || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    seo: { ...current.business.seo, title: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="SEO descricao">
              <input
                value={draft.business.seo?.description || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    seo: { ...current.business.seo, description: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <ThemeColorField
              label="Cor primaria"
              value={draft.theme.colors?.primary || '#f97316'}
              fallback="#f97316"
              onChange={(nextValue) => setDraft((current) => ({
                ...current,
                theme: buildDerivedTheme(current.theme, { primary: nextValue }),
              }))}
            />
            <ThemeColorField
              label="Cor secundaria"
              value={draft.theme.colors?.secondary || '#fb7185'}
              fallback="#fb7185"
              onChange={(nextValue) => setDraft((current) => ({
                ...current,
                theme: buildDerivedTheme(current.theme, { secondary: nextValue }),
              }))}
            />
            <ThemeColorField
              label="Fundo"
              value={draft.theme.colors?.background || '#140d09'}
              fallback="#140d09"
              onChange={(nextValue) => setDraft((current) => ({
                ...current,
                theme: buildDerivedTheme(current.theme, { background: nextValue }),
              }))}
            />
            <ThemeColorField
              label="Texto"
              value={draft.theme.colors?.text || '#fff8f2'}
              fallback="#fff8f2"
              onChange={(nextValue) => setDraft((current) => ({
                ...current,
                theme: buildDerivedTheme(current.theme, { text: nextValue }),
              }))}
            />
          </div>

          <div id="tenant-footer-signature" className="admin-subpanel admin-subpanel--highlight">
            <div className="admin-panel-card__header">
              <div>
                <h2>Assinatura do criador</h2>
                <p>Um rodape discreto para creditar a criacao do site e manter um contato rapido.</p>
              </div>
              <Button
                variant={ctaSection?.visible !== false ? 'primary' : 'secondary'}
                className="admin-toggle-button"
                onClick={() => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                    section.visible = section.visible === false;
                  });
                  return nextDraft;
                })}
              >
                {ctaSection?.visible !== false ? 'Assinatura visivel' : 'Assinatura oculta'}
              </Button>
            </div>

            <div className="admin-form-grid">
              <AdminField label="Titulo do rodape">
                <input
                  value={ctaSection?.title || ''}
                  onChange={(event) => setDraft((current) => {
                    const nextDraft = cloneDeep(current);
                    updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                      section.title = event.target.value;
                    });
                    return nextDraft;
                  })}
                />
              </AdminField>
              <AdminField label="Legenda">
                <input
                  value={ctaSection?.settings?.eyebrow || ''}
                  onChange={(event) => setDraft((current) => {
                    const nextDraft = cloneDeep(current);
                    updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                      section.settings = {
                        ...(section.settings || {}),
                        variant: section.settings?.variant || 'footer-signature',
                        eyebrow: event.target.value,
                      };
                    });
                    return nextDraft;
                  })}
                />
              </AdminField>
              <AdminField label="Label do botao">
                <input
                  value={ctaSection?.settings?.primaryAction?.label || ''}
                  onChange={(event) => setDraft((current) => {
                    const nextDraft = cloneDeep(current);
                    updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                      section.settings = {
                        ...(section.settings || {}),
                        variant: section.settings?.variant || 'footer-signature',
                        primaryAction: {
                          ...(section.settings?.primaryAction || {}),
                          label: event.target.value,
                        },
                      };
                    });
                    return nextDraft;
                  })}
                />
              </AdminField>
              <AdminField label="Link do Instagram" error={validationErrors['cta.primaryAction.href']}>
                <input
                  value={ctaSection?.settings?.primaryAction?.href || ''}
                  onChange={(event) => setDraft((current) => {
                    const nextDraft = cloneDeep(current);
                    updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                      section.settings = {
                        ...(section.settings || {}),
                        variant: section.settings?.variant || 'footer-signature',
                        primaryAction: {
                          ...(section.settings?.primaryAction || {}),
                          href: event.target.value,
                        },
                      };
                    });
                    return nextDraft;
                  })}
                  {...getInputState(validationErrors['cta.primaryAction.href'])}
                />
              </AdminField>
            </div>

            <AdminField label="Texto complementar">
              <textarea
                rows="3"
                value={ctaSection?.description || ''}
                onChange={(event) => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                    section.description = event.target.value;
                  });
                  return nextDraft;
                })}
              />
            </AdminField>
          </div>

          <div className="admin-sections-list">
            {draft.sections
              .filter((section) => !HIDDEN_ADMIN_SECTION_KEYS.has(section.key))
              .map((section) => (
              <div key={section.key} className="admin-sections-list__item">
                <div className="admin-section-summary">
                  <strong>{getSectionDisplayLabel(section)}</strong>
                  <div className="admin-section-summary__meta">
                    <span className="admin-section-chip">{getSectionTypeLabel(section)}</span>
                    <span className="admin-section-chip admin-section-chip--muted">ID: {section.key}</span>
                  </div>
                </div>
                <div className="admin-sections-list__controls">
                  <Button
                    variant={section.visible !== false ? 'primary' : 'secondary'}
                    className="admin-toggle-button"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      sections: current.sections.map((item) =>
                        item.key === section.key ? { ...item, visible: item.visible === false } : item,
                      ),
                    }))}
                  >
                    {section.visible !== false ? 'Visivel' : 'Oculta'}
                  </Button>
                  <label className="admin-section-order">
                    <span>Ordem</span>
                    <input
                      type="number"
                      value={section.order}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        sections: current.sections.map((item) =>
                          item.key === section.key ? { ...item, order: Number(event.target.value) } : item,
                        ),
                      }))}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          </div>
        </Card>

        <Card className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <h2>Historico de alteracoes</h2>
              <p>Registro leve das ultimas mudancas salvas para este tenant.</p>
            </div>
            <span className="admin-section-chip admin-section-chip--accent">{historyEntries.length} item(ns)</span>
          </div>

          <div className="admin-event-list admin-event-list--scroll">
            {historyEntries.length ? (
              historyEntries.slice(0, 16).map((entry, index) => (
                <div key={`${entry.field}-${entry.changedAt || index}`} className="admin-event-item admin-event-item--analytics">
                  <div>
                    <span className="admin-section-chip admin-section-chip--muted">{entry.field}</span>
                    <strong>
                      {formatHistoryValue(entry.oldValue)} {'->'} {formatHistoryValue(entry.newValue)}
                    </strong>
                    <span>Mudanca registrada no ultimo salvamento disponivel.</span>
                  </div>
                  <time dateTime={entry.changedAt}>{formatAnalyticsTimestamp(entry.changedAt)}</time>
                </div>
              ))
            ) : (
              <p className="admin-muted-copy">Ainda nao existem alteracoes salvas para este tenant.</p>
            )}
          </div>
        </Card>

        <Card id="tenant-analytics" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <h2>Analytics do tenant</h2>
              <p>Mostre valor rapidamente com volume de acessos e interacoes.</p>
            </div>
          </div>

          <div className="admin-analytics-summary">
            <div className="admin-analytics-stat-card">
              <span>Total de eventos</span>
              <strong>{analyticsSummary?.totalEvents || 0}</strong>
              <small>Visao consolidada de todas as interacoes.</small>
            </div>
            <div className="admin-analytics-stat-card">
              <span>Ultimos 7 dias</span>
              <strong>{analyticsSummary?.last7DaysEvents || 0}</strong>
              <small>Movimento recente do tenant na ultima semana.</small>
            </div>
            <div className="admin-analytics-stat-card">
              <span>Tipos rastreados</span>
              <strong>{analyticsByEventType.length}</strong>
              <small>Quantos comportamentos diferentes o painel ja capturou.</small>
            </div>
            <div className="admin-analytics-stat-card">
              <span>Ultimo registro</span>
              <strong>{latestAnalyticsEvent ? formatAnalyticsTimestamp(latestAnalyticsEvent.occurredAt) : 'Sem eventos'}</strong>
              <small>{latestAnalyticsEvent ? getAnalyticsEventLabel(latestAnalyticsEvent.eventType) : 'Assim que chegar um evento ele aparece aqui.'}</small>
            </div>
          </div>

          <div className="admin-analytics-panels">
            <div className="admin-analytics-panel">
              <div className="admin-analytics-panel__header">
                <div>
                  <h3>Eventos por tipo</h3>
                  <p>Entenda o que o visitante faz com mais frequencia.</p>
                </div>
              </div>

              <div className="admin-ranked-list admin-ranked-list--scroll">
                {analyticsByEventType.map((item) => (
                  <div key={item.eventType} className="admin-ranked-item admin-ranked-item--analytics">
                    <div>
                      <span className="admin-section-chip admin-section-chip--accent">
                        {getAnalyticsEventLabel(item.eventType)}
                      </span>
                      <strong>{getAnalyticsEventLabel(item.eventType)}</strong>
                      <span>{item.count} evento(s) registrados.</span>
                    </div>
                    <div className="admin-ranked-item__meta">
                      <b>{item.count}</b>
                      <div className="admin-meter">
                        <span style={{ width: `${Math.max(10, (item.count / maxAnalyticsEventCount) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-analytics-panel">
              <div className="admin-analytics-panel__header">
                <div>
                  <h3>Timeline recente</h3>
                  <p>Ultimas acoes registradas para este tenant.</p>
                </div>
              </div>

              <div className="admin-event-list admin-event-list--scroll">
                {recentAnalyticsEvents.map((event) => (
                  <div key={event.id} className="admin-event-item admin-event-item--analytics">
                    <div>
                      <span className="admin-section-chip admin-section-chip--muted">
                        {getAnalyticsEventLabel(event.eventType)}
                      </span>
                      <strong>{getAnalyticsTargetSummary(event)}</strong>
                      <span>
                        {event.targetLabel || event.targetType || 'Sem alvo'}
                      </span>
                    </div>
                    <time dateTime={event.occurredAt}>{formatAnalyticsTimestamp(event.occurredAt)}</time>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
