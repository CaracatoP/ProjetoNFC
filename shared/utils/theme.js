export const TENANT_THEME_VERSION = 2;

export const DEFAULT_TENANT_THEME_RAW = Object.freeze({
  version: TENANT_THEME_VERSION,
  backgroundColor: '#111111',
  cardColor: '#1d1d1d',
  buttonHoverColor: '#2b2b2b',
  primaryButtonColor: '#c8a46a',
  textColor: '#f5f5f5',
  accentColor: '#c8a46a',
  borderColor: '#333333',
  secondaryColor: '#8a6b4a',
});

// Backward-compatible alias kept because parts of the editor import this symbol.
export const DEFAULT_TENANT_THEME_COLORS = DEFAULT_TENANT_THEME_RAW;

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

const RAW_THEME_KEYS = Object.freeze([
  'backgroundColor',
  'cardColor',
  'buttonHoverColor',
  'primaryButtonColor',
  'textColor',
  'accentColor',
  'borderColor',
  'secondaryColor',
]);

const LEGACY_OVERRIDE_KEY_MAP = Object.freeze({
  background: 'backgroundColor',
  surface: 'cardColor',
  surfaceAlt: 'cardColor',
  primary: 'primaryButtonColor',
  text: 'textColor',
  accent: 'accentColor',
  border: 'borderColor',
  secondary: 'secondaryColor',
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

function extractFirstHexColor(value) {
  const match = String(value || '').match(/#(?:[\da-fA-F]{3}|[\da-fA-F]{6})\b|\b(?:[\da-fA-F]{3}|[\da-fA-F]{6})\b/);
  return match ? normalizeHexColor(match[0], '') : '';
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
    return normalizeHexColor(base, DEFAULT_TENANT_THEME_RAW.backgroundColor);
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

function hasOwnRawThemeFields(theme = {}) {
  return RAW_THEME_KEYS.some((key) => theme[key] !== undefined);
}

function mapLegacyValueToRawColor(theme = {}, rawKey) {
  const themeColors = theme.colors || {};

  switch (rawKey) {
    case 'backgroundColor':
      return extractFirstHexColor(themeColors.background);
    case 'cardColor':
      return (
        extractFirstHexColor(theme.cardColor)
        || extractFirstHexColor(themeColors.card)
        || extractFirstHexColor(themeColors.surface)
        || ''
      );
    case 'buttonHoverColor':
      return (
        extractFirstHexColor(theme.buttonHoverColor)
        || extractFirstHexColor(themeColors.hover)
        || extractFirstHexColor(themeColors.surfaceAlt)
        || ''
      );
    case 'primaryButtonColor':
      return extractFirstHexColor(theme.primaryButtonColor || themeColors.primary || theme.buttons?.primary?.background);
    case 'textColor':
      return extractFirstHexColor(theme.textColor || themeColors.text);
    case 'accentColor':
      return extractFirstHexColor(theme.accentColor || themeColors.accent || themeColors.primary);
    case 'borderColor':
      return extractFirstHexColor(theme.borderColor || themeColors.border);
    case 'secondaryColor':
      return extractFirstHexColor(theme.secondaryColor || themeColors.secondary);
    default:
      return '';
  }
}

function buildLegacyMetadata(theme = {}) {
  return {
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
    customCss: String(theme.customCss || ''),
  };
}

function normalizeRawOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== 'object') {
    return {};
  }

  return Object.entries(overrides).reduce((accumulator, [key, value]) => {
    const rawKey = RAW_THEME_KEYS.includes(key) ? key : LEGACY_OVERRIDE_KEY_MAP[key];

    if (rawKey) {
      accumulator[rawKey] = value;
    }

    return accumulator;
  }, {});
}

export function normalizeRawTenantTheme(theme = {}, overrides = {}) {
  const baseTheme = theme?.raw && typeof theme.raw === 'object' ? theme.raw : theme;
  const rawOverrides = normalizeRawOverrides(overrides);
  const legacyMetadata = buildLegacyMetadata(theme);

  const resolvedRaw = RAW_THEME_KEYS.reduce((accumulator, key) => {
    const candidateValue =
      rawOverrides[key]
      ?? baseTheme?.[key]
      ?? mapLegacyValueToRawColor(baseTheme, key)
      ?? mapLegacyValueToRawColor(theme, key)
      ?? DEFAULT_TENANT_THEME_RAW[key];

    accumulator[key] = normalizeHexColor(candidateValue, DEFAULT_TENANT_THEME_RAW[key]);
    return accumulator;
  }, { version: TENANT_THEME_VERSION });

  return {
    ...resolvedRaw,
    ...legacyMetadata,
  };
}

function buildPrimaryButtonBackground(primary) {
  return primary;
}

function buildSecondaryButtonBackground(cardColor) {
  return cardColor;
}

export function buildTenantTheme(theme = {}, overrides = {}) {
  const normalizedTheme = normalizeRawTenantTheme(theme, overrides);
  const background = normalizedTheme.backgroundColor;
  const card = normalizedTheme.cardColor;
  const hover = normalizedTheme.buttonHoverColor;
  const primary = normalizedTheme.primaryButtonColor;
  const text = normalizedTheme.textColor;
  const accent = normalizedTheme.accentColor;
  const border = normalizedTheme.borderColor;
  const secondary = normalizedTheme.secondaryColor;
  const backgroundIsLight = isLightColor(background);
  const cardAlt = mixHexColors(card, backgroundIsLight ? '#000000' : '#ffffff', backgroundIsLight ? 0.08 : 0.08);
  const textMuted = hexToRgba(text, backgroundIsLight ? 0.68 : 0.72);
  const accentSoft = hexToRgba(accent, backgroundIsLight ? 0.18 : 0.24);
  const secondarySoft = hexToRgba(secondary, backgroundIsLight ? 0.16 : 0.24);

  return {
    version: TENANT_THEME_VERSION,
    raw: {
      version: TENANT_THEME_VERSION,
      backgroundColor: background,
      cardColor: card,
      buttonHoverColor: hover,
      primaryButtonColor: primary,
      textColor: text,
      accentColor: accent,
      borderColor: border,
      secondaryColor: secondary,
    },
    colors: {
      background,
      card,
      cardAlt,
      hover,
      primary,
      secondary,
      text,
      textMuted,
      border,
      accent,
      accentSoft,
      secondarySoft,
      // Backward-compatible aliases for existing UI code.
      surface: card,
      surfaceAlt: cardAlt,
    },
    typography: normalizedTheme.typography,
    spacing: normalizedTheme.spacing,
    radius: normalizedTheme.radius,
    layout: normalizedTheme.layout,
    buttons: {
      primary: {
        background: buildPrimaryButtonBackground(primary),
        hoverBackground: hover,
        color: getReadableTextColor(primary, { dark: '#161616' }),
        border: `1px solid ${primary}`,
      },
      secondary: {
        background: buildSecondaryButtonBackground(card),
        hoverBackground: hover,
        color: text,
        border: `1px solid ${border}`,
      },
    },
    areas: {
      headerBackground: secondary,
      specialBackground: mixHexColors(secondary, background, backgroundIsLight ? 0.14 : 0.32),
    },
    customCss: normalizedTheme.customCss,
  };
}

export function createDefaultTheme() {
  return buildTenantTheme({});
}

export function buildThemeCssVariables(theme = {}) {
  const resolvedTheme = buildTenantTheme(theme);

  return {
    '--theme-background': resolvedTheme.colors.background,
    '--theme-card': resolvedTheme.colors.card,
    '--theme-card-alt': resolvedTheme.colors.cardAlt,
    '--theme-button-hover': resolvedTheme.colors.hover,
    '--theme-primary-button': resolvedTheme.colors.primary,
    '--theme-secondary-area': resolvedTheme.colors.secondary,
    '--theme-text': resolvedTheme.colors.text,
    '--theme-text-muted': resolvedTheme.colors.textMuted,
    '--theme-border': resolvedTheme.colors.border,
    '--theme-accent': resolvedTheme.colors.accentSoft,
    '--theme-accent-solid': resolvedTheme.colors.accent,
    '--theme-success': '#22c55e',
    '--theme-danger': '#ef4444',
    // Backward-compatible aliases for current styling.
    '--theme-primary': resolvedTheme.colors.primary,
    '--theme-secondary': resolvedTheme.colors.secondary,
    '--theme-surface': resolvedTheme.colors.surface,
    '--theme-surface-alt': resolvedTheme.colors.surfaceAlt,
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
    '--button-primary-hover-bg': resolvedTheme.buttons.primary.hoverBackground,
    '--button-primary-color': resolvedTheme.buttons.primary.color,
    '--button-primary-border': resolvedTheme.buttons.primary.border,
    '--button-secondary-bg': resolvedTheme.buttons.secondary.background,
    '--button-secondary-hover-bg': resolvedTheme.buttons.secondary.hoverBackground,
    '--button-secondary-color': resolvedTheme.buttons.secondary.color,
    '--button-secondary-border': resolvedTheme.buttons.secondary.border,
  };
}
