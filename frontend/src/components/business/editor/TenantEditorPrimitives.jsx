import { useEffect, useId, useState } from 'react';
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

export function ThemeColorField({ label, value, fallback, onChange }) {
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
