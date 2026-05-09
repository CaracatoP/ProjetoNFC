import { describe, expect, it } from 'vitest';
import { THEME_COLOR_PRESETS, applyThemePreset, buildDerivedTheme } from './tenantEditorUtils.js';

const baseTheme = {
  colors: {
    primary: '#f97316',
    secondary: '#fb7185',
    background: '#140d09',
    text: '#fff8f2',
  },
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
  it('keeps each brand color independent and assigns primary/secondary roles predictably', () => {
    const nextTheme = buildDerivedTheme(baseTheme, { background: '#f3ecdf' });

    expect(nextTheme.colors.background).toBe('#f3ecdf');
    expect(nextTheme.colors.primary).toBe('#f97316');
    expect(nextTheme.colors.secondary).toBe('#fb7185');
    expect(nextTheme.buttons.primary.background).toContain('#f97316');
    expect(nextTheme.buttons.primary.background).not.toContain('#fb7185');
    expect(nextTheme.buttons.secondary.border).toContain('251, 113, 133');
  });

  it('applies a preset palette without dropping existing tenant settings', () => {
    const preset = THEME_COLOR_PRESETS.find((candidate) => candidate.id === 'escuro-premium');

    expect(preset).toBeDefined();

    const nextTheme = applyThemePreset(baseTheme, preset.colors);

    expect(nextTheme.colors.background).toBe(preset.colors.background);
    expect(nextTheme.colors.primary).toBe(preset.colors.primary);
    expect(nextTheme.colors.secondary).toBe(preset.colors.secondary);
    expect(nextTheme.colors.text).toBe(preset.colors.text);
    expect(nextTheme.typography.headingFamily).toBe(baseTheme.typography.headingFamily);
    expect(nextTheme.customCss).toBe(baseTheme.customCss);
  });
});
