import { useMemo, useState } from 'react';
import { BUSINESS_MODULE_KEY_VALUES, BUSINESS_SEGMENT_VALUES } from '@shared/constants/index.js';
import { buildBusinessSegmentState, getSegmentPreset } from '@shared/utils/segments.js';
import { slugify } from '@shared/utils/tenantIdentity.js';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';

const initialForm = {
  name: '',
  slug: '',
  whatsapp: '',
  addressDisplay: '',
  description: '',
  segment: 'other',
};

const MODULE_LABELS = {
  catalog: 'Catalogo',
  appointments: 'Agendamentos',
  cart: 'Carrinho',
  orders: 'Pedidos',
  loyalty: 'Fidelidade',
  whatsapp: 'WhatsApp',
  analytics: 'Analytics',
};

export function TenantOnboardingForm({ creating, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [slugTouched, setSlugTouched] = useState(false);

  const suggestedSlug = useMemo(() => slugify(form.name), [form.name]);
  const segmentState = useMemo(() => buildBusinessSegmentState({ segment: form.segment }), [form.segment]);
  const segmentPreset = useMemo(() => getSegmentPreset(form.segment), [form.segment]);
  const previewSlug = form.slug || suggestedSlug || 'seu-negocio';
  const publicPreviewUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/site/${previewSlug}` : `/site/${previewSlug}`;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    await onCreate?.({
      business: {
        name: form.name.trim(),
        slug: (form.slug || suggestedSlug).trim(),
        status: 'active',
        description: form.description.trim(),
        segment: segmentState.segment,
        modules: segmentState.modules,
        segmentConfig: segmentState.segmentConfig,
        contact: {
          whatsapp: form.whatsapp.trim(),
          phone: form.whatsapp.trim(),
        },
        address: {
          display: form.addressDisplay.trim(),
        },
      },
    });

    setForm(initialForm);
    setSlugTouched(false);
  }

  return (
    <Card className="admin-panel-card admin-panel-card--sidebar">
      <div className="admin-panel-card__header">
        <div>
          <h2>Novo comercio</h2>
          <p>Cadastre um tenant novo em poucos campos e depois refine no editor.</p>
        </div>
        <span className="admin-section-chip admin-section-chip--accent">Ativo ao criar</span>
      </div>

      <form className="admin-form admin-form--stack" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Nome do comercio</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  slug: slugTouched ? current.slug : slugify(event.target.value),
                }))
              }
              placeholder="Ex.: Restaurante Vista Boa"
            />
          </label>

          <label className="admin-field">
            <span>Slug publico</span>
            <input
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((current) => ({ ...current, slug: slugify(event.target.value, { preserveTrailingSeparator: true }) }));
              }}
              onBlur={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
              placeholder={suggestedSlug || 'restaurante-vista-boa'}
            />
          </label>
        </div>

        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Segmento da empresa</span>
            <select value={form.segment} onChange={(event) => setForm((current) => ({ ...current, segment: event.target.value }))}>
              {BUSINESS_SEGMENT_VALUES.map((segmentValue) => (
                <option key={segmentValue} value={segmentValue}>
                  {getSegmentPreset(segmentValue).label}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-inline-note admin-inline-note--preview">
            <strong>{segmentPreset.label}</strong>
            <span>{segmentPreset.description}</span>
          </div>
        </div>

        <div className="admin-inline-note admin-inline-note--preview">
          <strong>URL inicial do tenant</strong>
          <span className="admin-inline-note__value">{publicPreviewUrl}</span>
          <span>O tenant ja nasce ativo e voce cai direto no editor para completar branding, secoes e links.</span>
        </div>

        <div className="admin-inline-note admin-inline-note--preview">
          <strong>Modulos sugeridos</strong>
          <div className="admin-module-badges">
            {BUSINESS_MODULE_KEY_VALUES.filter((key) => segmentState.modules[key]).map((key) => (
              <span key={key} className="admin-section-chip admin-section-chip--accent">
                {MODULE_LABELS[key]}
              </span>
            ))}
          </div>
          <span>Depois da criacao voce pode ajustar cada modulo manualmente no editor.</span>
        </div>

        <div className="admin-form-grid">
          <label className="admin-field">
            <span>WhatsApp</span>
            <input
              value={form.whatsapp}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))}
              placeholder="5511999999999"
            />
          </label>

          <label className="admin-field">
            <span>Endereco</span>
            <input
              value={form.addressDisplay}
              onChange={(event) => setForm((current) => ({ ...current, addressDisplay: event.target.value }))}
              placeholder="Rua, numero, bairro, cidade"
            />
          </label>
        </div>

        <label className="admin-field">
          <span>Descricao inicial</span>
          <textarea
            rows="4"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Resumo do negocio para gerar a pagina inicial."
          />
        </label>

        <Button type="submit" disabled={creating}>
          {creating ? 'Criando tenant...' : 'Criar tenant e abrir editor'}
        </Button>
      </form>
    </Card>
  );
}
