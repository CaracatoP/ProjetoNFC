import { z } from 'zod';

export const rawThemeSchema = z.object({
  version: z.literal(2),
  backgroundColor: z.string(),
  cardColor: z.string(),
  buttonHoverColor: z.string(),
  primaryButtonColor: z.string(),
  textColor: z.string(),
  accentColor: z.string(),
  borderColor: z.string(),
  secondaryColor: z.string(),
});

export const colorTokensSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  card: z.string(),
  cardAlt: z.string(),
  hover: z.string(),
  surface: z.string(),
  surfaceAlt: z.string().optional(),
  text: z.string(),
  textMuted: z.string(),
  border: z.string(),
  accent: z.string(),
  accentSoft: z.string().optional(),
  secondarySoft: z.string().optional(),
});

export const typographyTokensSchema = z.object({
  headingFamily: z.string(),
  bodyFamily: z.string(),
  baseSize: z.string(),
  heroSize: z.string(),
  sectionTitleSize: z.string(),
});

export const spacingTokensSchema = z.object({
  xs: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  xxl: z.string(),
});

export const radiusTokensSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  pill: z.string(),
});

export const layoutTokensSchema = z.object({
  maxWidth: z.string(),
  pagePadding: z.string(),
  sectionGap: z.string(),
  cardGap: z.string(),
});

export const buttonTokensSchema = z.object({
  primary: z.object({
    background: z.string(),
    hoverBackground: z.string().optional(),
    color: z.string(),
    border: z.string().optional(),
  }),
  secondary: z.object({
    background: z.string(),
    hoverBackground: z.string().optional(),
    color: z.string(),
    border: z.string().optional(),
  }),
});

export const themeSchema = z.object({
  version: z.literal(2),
  raw: rawThemeSchema,
  colors: colorTokensSchema,
  typography: typographyTokensSchema,
  spacing: spacingTokensSchema,
  radius: radiusTokensSchema,
  layout: layoutTokensSchema,
  buttons: buttonTokensSchema,
  areas: z.object({
    headerBackground: z.string(),
    specialBackground: z.string(),
  }).optional(),
  customCss: z.string().optional(),
});
