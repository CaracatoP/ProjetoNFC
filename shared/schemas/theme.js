import { z } from 'zod';

export const colorTokensSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  surface: z.string(),
  surfaceAlt: z.string().optional(),
  text: z.string(),
  textMuted: z.string(),
  border: z.string(),
  success: z.string().optional(),
  danger: z.string().optional(),
  accent: z.string().optional(),
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
    color: z.string(),
    border: z.string().optional(),
  }),
  secondary: z.object({
    background: z.string(),
    color: z.string(),
    border: z.string().optional(),
  }),
});

export const themeSchema = z.object({
  colors: colorTokensSchema,
  typography: typographyTokensSchema,
  spacing: spacingTokensSchema,
  radius: radiusTokensSchema,
  layout: layoutTokensSchema,
  buttons: buttonTokensSchema,
  customCss: z.string().optional(),
});

