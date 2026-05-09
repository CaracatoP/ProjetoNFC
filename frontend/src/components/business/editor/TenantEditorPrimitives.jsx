import { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { resolveMediaUrl } from '@/utils/formatters.js';
import { getInputState, isHexColor, normalizeHexColor } from './tenantEditorUtils.js';

export function AdminField({ label, children, description, error }) {
  return (
    <label className={`admin-field ${error ? 'admin-field--invalid' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="admin-field__error">{error}</small> : null}
      {description ? <small>{description}</small> : null}
    </label>
  );
}

export function SectionEyebrow({ children }) {
  return <span className="admin-editor-kicker">{children}</span>;
}

export function SensitiveInput({ label, value, onChange, placeholder, error }) {
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

export function ThemeColorCard({ label, description, value, fallback, onChange, onReset }) {
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
    <section className="theme-color-card">
      <div className="theme-color-card__preview">
        <span className="theme-color-card__eyebrow">{label}</span>
        <strong>{normalizedValue.toUpperCase()}</strong>
        <small>{description}</small>
        <span className="theme-color-card__swatch" style={{ background: normalizedValue }} aria-hidden="true" />
      </div>

      <div className="theme-color-card__controls">
        <label className="theme-color-card__picker">
          <span>Seletor</span>
          <input
            type="color"
            aria-label={`Selecionar ${label}`}
            value={normalizedValue}
            onChange={(event) => commit(event.target.value)}
          />
        </label>

        <label className="theme-color-card__input">
          <span>Hexadecimal</span>
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
        </label>

        <Button
          variant="secondary"
          className="theme-color-card__reset"
          onClick={() => {
            setTextValue(fallback);
            onReset?.();
          }}
        >
          Restaurar padrao
        </Button>
      </div>
    </section>
  );
}

export function ThemeColorField({ label, value, fallback, onChange }) {
  return (
    <ThemeColorCard
      label={label}
      description="Use um valor hexadecimal, por exemplo #f97316."
      value={value}
      fallback={fallback}
      onChange={onChange}
      onReset={() => onChange?.(fallback)}
    />
  );
}

export function PreviewImage({ src, alt }) {
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
