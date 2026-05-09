export const DEFAULT_TENANT_THEME_COLORS = Object.freeze({
  primary: '#f97316',
  secondary: '#fb7185',
  background: '#140d09',
  text: '#fff8f2',
  success: '#22c55e',
  danger: '#ef4444',
});

const DEFAULT_TENANT_THEME_TYPOGRAPHY = Object.freeze({
  headingFamily: "'Space Grotesk', sans-serif",
  bodyFamily: "'Manrope', sans-serif",
  baseSize: '16px',
  heroSize: 'clamp(2.2rem, 5.8vw, 4rem)',
  sectionTitleSize: 'clamp(1.15rem, 2.8vw, 1.7rem)',
});

const DEFAULT_TENANT_THEME_SPACING = Object.freeze({
  xs: '0.35rem',
  sm: '0.65rem',
  md: '1rem',
  lg: '1.4rem',
  xl: '1.8rem',
  xxl: '2.4rem',
});

const DEFAULT_TENANT_THEME_RADIUS = Object.freeze({
  sm: '0.9rem',
  md: '1.4rem',
  lg: '2rem',
  pill: '999px',
});

const DEFAULT_TENANT_THEME_LAYOUT = Object.freeze({
  maxWidth: '1180px',
  pagePadding: 'clamp(1rem, 3vw, 2rem)',
  sectionGap: '1.1rem',
  cardGap: '0.85rem',
});

export function isHexColor(value) {
  return /^#([\da-fA-F]{6}|[\da-fA-F]{3})$/.test(String(value || '').trim());
}

export function normalizeHexColor(value, fallback = '#000000') {
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

function hexToRgb(value) {
  const hex = normalizeHexColor(value, '').replace('#', '');

  if (!hex) {
    return null;
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function hexToRgba(value, alpha) {
  const rgb = hexToRgb(value);

  if (!rgb) {
    return value;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function mixHexColors(base, mixWith, weight) {
  const first = hexToRgb(base);
  const second = hexToRgb(mixWith);

  if (!first || !second) {
    return normalizeHexColor(base, DEFAULT_TENANT_THEME_COLORS.background);
  }

  const mixChannel = (channel) =>
    Math.round(first[channel] * (1 - weight) + second[channel] * weight)
      .toString(16)
      .padStart(2, '0');

  return `#${mixChannel('r')}${mixChannel('g')}${mixChannel('b')}`;
}

function getRelativeLuminanceChannel(channel) {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(color) {
  const rgb = hexToRgb(color);

  if (!rgb) {
    return 0;
  }

  return (
    0.2126 * getRelativeLuminanceChannel(rgb.r)
    + 0.7152 * getRelativeLuminanceChannel(rgb.g)
    + 0.0722 * getRelativeLuminanceChannel(rgb.b)
  );
}

export function getContrastRatio(firstColor, secondColor) {
  const first = getRelativeLuminance(firstColor);
  const second = getRelativeLuminance(secondColor);
  const brightest = Math.max(first, second);
  const darkest = Math.min(first, second);

  return (brightest + 0.05) / (darkest + 0.05);
}

function isLightColor(color) {
  return getRelativeLuminance(color) > 0.58;
}

export function getReadableTextColor(background, options = {}) {
  const lightColor = normalizeHexColor(options.light || '#ffffff', '#ffffff');
  const darkColor = normalizeHexColor(options.dark || '#1a120f', '#1a120f');
  const lightContrast = getContrastRatio(background, lightColor);
  const darkContrast = getContrastRatio(background, darkColor);

  return darkContrast >= lightContrast ? darkColor : lightColor;
}

function buildPrimaryButtonBackground(primary) {
  const highlight = mixHexColors(primary, isLightColor(primary) ? '#000000' : '#ffffff', isLightColor(primary) ? 0.14 : 0.18);
  return `linear-gradient(135deg, ${primary}, ${highlight})`;
}

function buildSecondaryButtonBackground(background, secondary) {
  const backgroundIsLight = isLightColor(background);
  const firstStop = mixHexColors(background, secondary, backgroundIsLight ? 0.18 : 0.28);
  const secondStop = mixHexColors(background, secondary, backgroundIsLight ? 0.08 : 0.16);
  return `linear-gradient(135deg, ${firstStop}, ${secondStop})`;
}

export function buildTenantTheme(theme = {}, overrides = {}) {
  const themeColors = theme.colors || {};
  const primary = normalizeHexColor(overrides.primary ?? themeColors.primary, DEFAULT_TENANT_THEME_COLORS.primary);
  const secondary = normalizeHexColor(overrides.secondary ?? themeColors.secondary, DEFAULT_TENANT_THEME_COLORS.secondary);
  const background = normalizeHexColor(overrides.background ?? themeColors.background, DEFAULT_TENANT_THEME_COLORS.background);
  const text = normalizeHexColor(overrides.text ?? themeColors.text, DEFAULT_TENANT_THEME_COLORS.text);
  const success = normalizeHexColor(themeColors.success, DEFAULT_TENANT_THEME_COLORS.success);
  const danger = normalizeHexColor(themeColors.danger, DEFAULT_TENANT_THEME_COLORS.danger);
  const backgroundIsLight = isLightColor(background);
  const surfaceBase = mixHexColors(background, backgroundIsLight ? '#000000' : '#ffffff', backgroundIsLight ? 0.04 : 0.08);
  const surfaceAltBase = mixHexColors(background, backgroundIsLight ? '#000000' : '#ffffff', backgroundIsLight ? 0.08 : 0.16);
  const secondaryButtonBase = mixHexColors(background, secondary, backgroundIsLight ? 0.18 : 0.28);

  return {
    colors: {
      primary,
      secondary,
      background,
      surface: hexToRgba(surfaceBase, backgroundIsLight ? 0.92 : 0.92),
      surfaceAlt: hexToRgba(surfaceAltBase, backgroundIsLight ? 0.9 : 0.86),
      text,
      textMuted: hexToRgba(text, backgroundIsLight ? 0.72 : 0.74),
      border: hexToRgba(text, backgroundIsLight ? 0.16 : 0.12),
      success,
      danger,
      accent: hexToRgba(primary, backgroundIsLight ? 0.14 : 0.18),
    },
    typography: {
      ...DEFAULT_TENANT_THEME_TYPOGRAPHY,
      ...(theme.typography || {}),
    },
    spacing: {
      ...DEFAULT_TENANT_THEME_SPACING,
      ...(theme.spacing || {}),
    },
    radius: {
      ...DEFAULT_TENANT_THEME_RADIUS,
      ...(theme.radius || {}),
    },
    layout: {
      ...DEFAULT_TENANT_THEME_LAYOUT,
      ...(theme.layout || {}),
    },
    buttons: {
      primary: {
        background: buildPrimaryButtonBackground(primary),
        color: getReadableTextColor(primary, { dark: '#1f1720' }),
        border: 'none',
      },
      secondary: {
        background: buildSecondaryButtonBackground(background, secondary),
        color: getReadableTextColor(secondaryButtonBase, { dark: '#1f1720' }),
        border: `1px solid ${hexToRgba(secondary, backgroundIsLight ? 0.38 : 0.34)}`,
      },
    },
    customCss: String(theme.customCss || ''),
  };
}

export function createDefaultTheme() {
  return buildTenantTheme({});
}

export function buildThemeCssVariables(theme = {}) {
  const resolvedTheme = buildTenantTheme(theme);

  return {
    '--theme-primary': resolvedTheme.colors.primary,
    '--theme-secondary': resolvedTheme.colors.secondary,
    '--theme-background': resolvedTheme.colors.background,
    '--theme-surface': resolvedTheme.colors.surface,
    '--theme-surface-alt': resolvedTheme.colors.surfaceAlt || resolvedTheme.colors.surface,
    '--theme-text': resolvedTheme.colors.text,
    '--theme-text-muted': resolvedTheme.colors.textMuted,
    '--theme-border': resolvedTheme.colors.border,
    '--theme-accent': resolvedTheme.colors.accent || 'rgba(255,255,255,0.08)',
    '--theme-danger': resolvedTheme.colors.danger || DEFAULT_TENANT_THEME_COLORS.danger,
    '--theme-success': resolvedTheme.colors.success || DEFAULT_TENANT_THEME_COLORS.success,
    '--font-heading': resolvedTheme.typography.headingFamily,
    '--font-body': resolvedTheme.typography.bodyFamily,
    '--font-base-size': resolvedTheme.typography.baseSize,
    '--font-hero-size': resolvedTheme.typography.heroSize,
    '--font-section-size': resolvedTheme.typography.sectionTitleSize,
    '--space-xs': resolvedTheme.spacing.xs,
    '--space-sm': resolvedTheme.spacing.sm,
    '--space-md': resolvedTheme.spacing.md,
    '--space-lg': resolvedTheme.spacing.lg,
    '--space-xl': resolvedTheme.spacing.xl,
    '--space-xxl': resolvedTheme.spacing.xxl,
    '--radius-sm': resolvedTheme.radius.sm,
    '--radius-md': resolvedTheme.radius.md,
    '--radius-lg': resolvedTheme.radius.lg,
    '--radius-pill': resolvedTheme.radius.pill,
    '--layout-max-width': resolvedTheme.layout.maxWidth,
    '--layout-page-padding': resolvedTheme.layout.pagePadding,
    '--layout-section-gap': resolvedTheme.layout.sectionGap,
    '--layout-card-gap': resolvedTheme.layout.cardGap,
    '--button-primary-bg': resolvedTheme.buttons.primary.background,
    '--button-primary-color': resolvedTheme.buttons.primary.color,
    '--button-primary-border': resolvedTheme.buttons.primary.border || 'none',
    '--button-secondary-bg': resolvedTheme.buttons.secondary.background,
    '--button-secondary-color': resolvedTheme.buttons.secondary.color,
    '--button-secondary-border': resolvedTheme.buttons.secondary.border || 'none',
  };
}
