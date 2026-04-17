import { useMemo, useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';

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

const initialForm = {
  name: '',
  slug: '',
  whatsapp: '',
  addressDisplay: '',
  description: '',
};

export function TenantOnboardingForm({ creating, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [slugTouched, setSlugTouched] = useState(false);

  const suggestedSlug = useMemo(() => slugify(form.name), [form.name]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    await onCreate?.({
      business: {
        name: form.name.trim(),
        slug: (form.slug || suggestedSlug).trim(),
        description: form.description.trim(),
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
      </div>

      <form className="admin-form admin-form--stack" onSubmit={handleSubmit}>
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
