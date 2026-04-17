import { useEffect } from 'react';

export function useTenantTheme(theme) {
  useEffect(() => {
    if (!theme) {
      return undefined;
    }

    const root = document.documentElement;
    const entries = [
      ['--theme-primary', theme.colors.primary],
      ['--theme-secondary', theme.colors.secondary],
      ['--theme-background', theme.colors.background],
      ['--theme-surface', theme.colors.surface],
      ['--theme-surface-alt', theme.colors.surfaceAlt || theme.colors.surface],
      ['--theme-text', theme.colors.text],
      ['--theme-text-muted', theme.colors.textMuted],
      ['--theme-border', theme.colors.border],
      ['--theme-accent', theme.colors.accent || 'rgba(255,255,255,0.08)'],
      ['--theme-danger', theme.colors.danger || '#ef4444'],
      ['--theme-success', theme.colors.success || '#22c55e'],
      ['--font-heading', theme.typography.headingFamily],
      ['--font-body', theme.typography.bodyFamily],
      ['--font-base-size', theme.typography.baseSize],
      ['--font-hero-size', theme.typography.heroSize],
      ['--font-section-size', theme.typography.sectionTitleSize],
      ['--space-xs', theme.spacing.xs],
      ['--space-sm', theme.spacing.sm],
      ['--space-md', theme.spacing.md],
      ['--space-lg', theme.spacing.lg],
      ['--space-xl', theme.spacing.xl],
      ['--space-xxl', theme.spacing.xxl],
      ['--radius-sm', theme.radius.sm],
      ['--radius-md', theme.radius.md],
      ['--radius-lg', theme.radius.lg],
      ['--radius-pill', theme.radius.pill],
      ['--layout-max-width', theme.layout.maxWidth],
      ['--layout-page-padding', theme.layout.pagePadding],
      ['--layout-section-gap', theme.layout.sectionGap],
      ['--layout-card-gap', theme.layout.cardGap],
      ['--button-primary-bg', theme.buttons.primary.background],
      ['--button-primary-color', theme.buttons.primary.color],
      ['--button-primary-border', theme.buttons.primary.border || 'none'],
      ['--button-secondary-bg', theme.buttons.secondary.background],
      ['--button-secondary-color', theme.buttons.secondary.color],
      ['--button-secondary-border', theme.buttons.secondary.border || 'none'],
    ];

    entries.forEach(([name, value]) => root.style.setProperty(name, value));

    let styleTag = null;

    if (theme.customCss) {
      styleTag = document.createElement('style');
      styleTag.setAttribute('data-tenant-theme', 'true');
      styleTag.textContent = theme.customCss;
      document.head.appendChild(styleTag);
    }

    return () => {
      if (styleTag) {
        styleTag.remove();
      }
    };
  }, [theme]);
}

