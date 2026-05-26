import { describe, expect, it } from 'vitest';
import { THEME_COLOR_PRESETS, applyThemePreset, buildDerivedTheme } from './tenantEditorUtils.js';

const baseTheme = {
  version: 2,
  backgroundColor: '#140d09',
  cardColor: '#221612',
  buttonHoverColor: '#2c1c17',
  primaryButtonColor: '#f97316',
  textColor: '#fff8f2',
  accentColor: '#fb7185',
  borderColor: '#4b342d',
  secondaryColor: '#7c3aed',
  typography: {
    headingFamily: "'Space Grotesk', sans-serif",
  },
  spacing: {},
  radius: {},
  layout: {},
  buttons: {},
  customCss: '.preview { color: red; }',
};

describe('tenantEditorUtils theme customization', () => {
  it('creates a v2 raw theme with canonical defaults when no theme is provided', () => {
    const nextTheme = buildDerivedTheme({});

    expect(nextTheme.raw.version).toBe(2);
    expect(nextTheme.raw.backgroundColor).toBe('#111111');
    expect(nextTheme.raw.cardColor).toBe('#1d1d1d');
    expect(nextTheme.raw.buttonHoverColor).toBe('#2b2b2b');
    expect(nextTheme.raw.primaryButtonColor).toBe('#c8a46a');
    expect(nextTheme.raw.textColor).toBe('#f5f5f5');
    expect(nextTheme.raw.accentColor).toBe('#c8a46a');
    expect(nextTheme.raw.borderColor).toBe('#333333');
    expect(nextTheme.raw.secondaryColor).toBe('#8a6b4a');
  });

  it('normalizes raw v2 hex input into lowercase six-digit values', () => {
    const nextTheme = buildDerivedTheme({
      version: 2,
      backgroundColor: 'FFF',
      cardColor: '#ABC',
      buttonHoverColor: '2B2B2B',
      primaryButtonColor: '#C8A46A',
      textColor: 'f5f5f5',
      accentColor: '#C8A46A',
      borderColor: '333',
      secondaryColor: '#8A6B4A',
    });

    expect(nextTheme.raw.backgroundColor).toBe('#ffffff');
    expect(nextTheme.raw.cardColor).toBe('#aabbcc');
    expect(nextTheme.raw.buttonHoverColor).toBe('#2b2b2b');
    expect(nextTheme.raw.primaryButtonColor).toBe('#c8a46a');
    expect(nextTheme.raw.textColor).toBe('#f5f5f5');
    expect(nextTheme.raw.accentColor).toBe('#c8a46a');
    expect(nextTheme.raw.borderColor).toBe('#333333');
    expect(nextTheme.raw.secondaryColor).toBe('#8a6b4a');
  });

  it('accepts a legacy resolved theme input and maps it to a v2 raw theme safely', () => {
    const nextTheme = buildDerivedTheme({
      colors: {
        background: '#140d09',
        surface: 'rgba(27, 18, 16, 0.92)',
        surfaceAlt: 'rgba(40, 26, 22, 0.92)',
        primary: '#f97316',
        secondary: '#7c3aed',
        text: '#fff8f2',
        border: 'rgba(75, 52, 45, 0.9)',
        accent: 'rgba(251, 113, 133, 0.24)',
      },
      buttons: {
        primary: {
          background: 'linear-gradient(135deg, #f97316, #ff8d41)',
          color: '#1f1720',
        },
        secondary: {
          background: 'linear-gradient(135deg, #221612, #2c1c17)',
          color: '#fff8f2',
          border: '1px solid rgba(75, 52, 45, 0.9)',
        },
      },
      typography: {
        headingFamily: "'Space Grotesk', sans-serif",
      },
      spacing: {},
      radius: {},
      layout: {},
      customCss: '.preview { color: red; }',
    });

    expect(nextTheme.raw.version).toBe(2);
    expect(nextTheme.raw.backgroundColor).toBe('#140d09');
    expect(nextTheme.raw.primaryButtonColor).toBe('#f97316');
    expect(nextTheme.raw.secondaryColor).toBe('#7c3aed');
    expect(nextTheme.raw.textColor).toBe('#fff8f2');
    expect(nextTheme.customCss).toBe('.preview { color: red; }');
  });

  it('keeps each brand color independent and assigns primary/secondary roles predictably', () => {
    const nextTheme = buildDerivedTheme(baseTheme, { backgroundColor: '#f3ecdf' });

    expect(nextTheme.colors.background).toBe('#f3ecdf');
    expect(nextTheme.colors.primary).toBe('#f97316');
    expect(nextTheme.colors.secondary).toBe('#7c3aed');
    expect(nextTheme.buttons.primary.background).toContain('#f97316');
    expect(nextTheme.buttons.primary.background).not.toContain('#7c3aed');
    expect(nextTheme.colors.card).toBe('#221612');
    expect(nextTheme.colors.border).toBe('#4b342d');
  });

  it('applies a preset palette without dropping existing tenant settings', () => {
    const preset = THEME_COLOR_PRESETS.find((candidate) => candidate.id === 'escuro-premium');

    expect(preset).toBeDefined();

    const nextTheme = applyThemePreset(baseTheme, preset.colors);

    expect(nextTheme.raw.backgroundColor).toBe(preset.colors.backgroundColor);
    expect(nextTheme.raw.primaryButtonColor).toBe(preset.colors.primaryButtonColor);
    expect(nextTheme.raw.secondaryColor).toBe(preset.colors.secondaryColor);
    expect(nextTheme.raw.textColor).toBe(preset.colors.textColor);
    expect(nextTheme.typography.headingFamily).toBe(baseTheme.typography.headingFamily);
    expect(nextTheme.customCss).toBe(baseTheme.customCss);
  });
});
