import {
  THEME_COLOR_DEFAULTS,
  THEME_COLOR_PRESETS,
  applyThemePreset,
  buildDerivedTheme,
  buildThemePreviewCssVariables,
  getThemeTextContrast,
} from './tenantEditorUtils.js';
import { SectionEyebrow, ThemeColorCard } from './TenantEditorPrimitives.jsx';

const COLOR_FIELDS = [
  {
    key: 'background',
    label: 'Cor de fundo',
    description: 'Controla apenas o background principal e a profundidade dos cards.',
  },
  {
    key: 'primary',
    label: 'Cor primaria',
    description: 'Usada em botoes principais, links importantes e destaques centrais.',
  },
  {
    key: 'secondary',
    label: 'Cor secundaria',
    description: 'Aplicada em bordas, icones, detalhes de apoio e acoes secundarias.',
  },
  {
    key: 'text',
    label: 'Cor do texto',
    description: 'Define a leitura principal do site e ajuda a ajustar contraste manualmente.',
  },
];

function ThemeLivePreview({ theme, businessName }) {
  return (
    <div
      className="theme-live-preview"
      data-testid="theme-live-preview"
      style={buildThemePreviewCssVariables(theme)}
    >
      <div className="theme-live-preview__canvas">
        <div className="theme-live-preview__hero">
          <div className="theme-live-preview__copy">
            <span className="section-eyebrow">Preview em tempo real</span>
            <h3>{businessName || 'Seu negocio'}</h3>
            <p>Veja fundo, titulo, botoes, links, detalhes e cards reagindo instantaneamente sem precisar salvar.</p>
            <a href="/" className="theme-live-preview__link" onClick={(event) => event.preventDefault()}>
              Link principal destacado
            </a>
          </div>

          <div className="button-row">
            <button type="button" className="button button--primary">Botao principal</button>
            <button type="button" className="button button--secondary">Botao secundario</button>
          </div>
        </div>

        <div className="theme-live-preview__grid">
          <article className="theme-live-preview__card section-card">
            <span className="theme-live-preview__icon" aria-hidden="true" />
            <strong>Cards com superficie</strong>
            <p>O fundo escolhido controla a atmosfera, enquanto a primaria e a secundaria mantem papeis separados.</p>
          </article>

          <article className="theme-live-preview__card section-card">
            <span className="theme-live-preview__icon theme-live-preview__icon--secondary" aria-hidden="true" />
            <strong>Detalhes de apoio</strong>
            <p>Bordas, chips e elementos auxiliares usam a secundaria sem invadir os destaques principais.</p>
          </article>

          <article className="theme-live-preview__card section-card">
            <div className="theme-live-preview__stats">
              <span className="theme-live-preview__pill">Card</span>
              <span className="theme-live-preview__pill theme-live-preview__pill--secondary">Secundario</span>
            </div>
            <strong>Legibilidade</strong>
            <p>O texto do site continua configuravel, com contraste automatico aplicado apenas onde for seguro.</p>
          </article>
        </div>
      </div>
    </div>
  );
}

export function ThemeCustomizationSection({ theme, businessName, onChange }) {
  const resolvedTheme = buildDerivedTheme(theme);
  const contrastRatio = getThemeTextContrast(resolvedTheme);
  const contrastIsHealthy = contrastRatio >= 4.5;

  return (
    <section className="theme-customizer">
      <div className="theme-customizer__header">
        <div>
          <SectionEyebrow>Branding</SectionEyebrow>
          <h2>Personalizacao de Cores</h2>
          <p>Edite cada cor de forma independente, aplique paletas prontas e acompanhe o resultado antes de salvar.</p>
        </div>

        <div className={`theme-contrast-note ${contrastIsHealthy ? 'theme-contrast-note--safe' : 'theme-contrast-note--warning'}`}>
          <strong>{contrastIsHealthy ? 'Contraste de texto ok' : 'Ajuste recomendado'}</strong>
          <span>
            {contrastIsHealthy
              ? `Relacao aproximada de ${contrastRatio.toFixed(1)}:1 entre fundo e texto.`
              : `Relacao aproximada de ${contrastRatio.toFixed(1)}:1. Se precisar, ajuste a cor do texto.`}
          </span>
        </div>
      </div>

      <div className="theme-preset-section">
        <div className="theme-preset-section__copy">
          <h3>Paletas prontas</h3>
          <p>Escolha um conjunto completo e depois refine qualquer cor sem perder o controle individual.</p>
        </div>

        <div className="theme-preset-grid">
          {THEME_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="theme-preset-card"
              onClick={() => onChange?.(applyThemePreset(resolvedTheme, preset.colors))}
            >
              <span className="theme-preset-card__label">{preset.label}</span>
              <span className="theme-preset-card__description">{preset.description}</span>
              <span className="theme-preset-card__swatches" aria-hidden="true">
                {Object.entries(preset.colors).map(([key, color]) => (
                  <span key={`${preset.id}-${key}`} className="theme-preset-card__swatch" style={{ background: color }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="theme-color-grid">
        {COLOR_FIELDS.map((field) => (
          <ThemeColorCard
            key={field.key}
            label={field.label}
            description={field.description}
            value={resolvedTheme.colors[field.key]}
            fallback={THEME_COLOR_DEFAULTS[field.key]}
            onChange={(nextValue) => onChange?.(buildDerivedTheme(resolvedTheme, { [field.key]: nextValue }))}
            onReset={() => onChange?.(buildDerivedTheme(resolvedTheme, { [field.key]: THEME_COLOR_DEFAULTS[field.key] }))}
          />
        ))}
      </div>

      <ThemeLivePreview theme={resolvedTheme} businessName={businessName} />
    </section>
  );
}
