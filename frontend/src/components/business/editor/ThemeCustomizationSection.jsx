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
    key: 'backgroundColor',
    label: 'Cor de fundo principal',
    description: 'Controla o fundo geral da pagina publica sem alterar automaticamente os outros tokens.',
  },
  {
    key: 'cardColor',
    label: 'Cor dos cards/botoes',
    description: 'Define a superficie principal dos cards, blocos internos e botoes neutros.',
  },
  {
    key: 'buttonHoverColor',
    label: 'Cor de hover dos botoes',
    description: 'Aparece quando o visitante passa o mouse ou interage com os botoes.',
  },
  {
    key: 'primaryButtonColor',
    label: 'Cor do botao principal/destaque',
    description: 'Usada no CTA principal e nas acoes de maior destaque.',
  },
  {
    key: 'textColor',
    label: 'Cor do texto principal',
    description: 'Define a leitura dominante do site e a base da legibilidade.',
  },
  {
    key: 'accentColor',
    label: 'Cor dos icones/detalhes',
    description: 'Usada em detalhes pequenos, icones, chips e realces complementares.',
  },
  {
    key: 'borderColor',
    label: 'Cor das bordas/linhas',
    description: 'Controla bordas, divisores e linhas de apoio sem invadir o restante do tema.',
  },
  {
    key: 'secondaryColor',
    label: 'Cor secundaria',
    description: 'Reservada para header e areas especiais que precisam de uma segunda personalidade visual.',
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
            <p>Veja fundo, header, cards, bordas, botoes, hover e detalhes reagindo instantaneamente sem precisar salvar.</p>
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
            <strong>Cards com superficie propria</strong>
            <p>Os cards e blocos ficam independentes do fundo, com cor dedicada para leitura e profundidade.</p>
          </article>

          <article className="theme-live-preview__card section-card">
            <span className="theme-live-preview__icon theme-live-preview__icon--secondary" aria-hidden="true" />
            <strong>Header e areas especiais</strong>
            <p>A cor secundaria colore zonas especiais sem roubar o papel do botao principal.</p>
          </article>

          <article className="theme-live-preview__card section-card">
            <div className="theme-live-preview__stats">
              <span className="theme-live-preview__pill">Card</span>
              <span className="theme-live-preview__pill theme-live-preview__pill--secondary">Header</span>
            </div>
            <strong>Hover e legibilidade</strong>
            <p>O texto segue configuravel, enquanto os estados de hover ficam separados para ajuste fino e previsivel.</p>
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
          <h2>Personalizacao Visual</h2>
          <p>Edite os 8 tokens do tenant com independencia total, aplique paletas prontas e confira o resultado antes de salvar.</p>
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
            value={resolvedTheme.raw[field.key]}
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
