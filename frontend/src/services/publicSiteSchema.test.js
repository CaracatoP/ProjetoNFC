import { describe, expect, it } from 'vitest';
import { publicSitePayloadSchema } from '@shared/schemas/index.js';

const baseTheme = {
  colors: {
    primary: '#7c3aed',
    secondary: '#ec4899',
    background: '#050509',
    surface: '#15111f',
    text: '#ffffff',
    textMuted: '#d8d3e5',
    border: 'rgba(255,255,255,.12)',
  },
  typography: {
    headingFamily: 'Space Grotesk',
    bodyFamily: 'Manrope',
    baseSize: '16px',
    heroSize: '3rem',
    sectionTitleSize: '1.5rem',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radius: {
    sm: '8px',
    md: '16px',
    lg: '24px',
    pill: '999px',
  },
  layout: {
    maxWidth: '1180px',
    pagePadding: '24px',
    sectionGap: '24px',
    cardGap: '16px',
  },
  buttons: {
    primary: { background: '#7c3aed', color: '#ffffff' },
    secondary: { background: '#15111f', color: '#ffffff' },
  },
};

describe('publicSitePayloadSchema', () => {
  it('preserves tenant domains and accepts services with optional images', () => {
    const parsed = publicSitePayloadSchema.parse({
      business: {
        id: 'business-1',
        slug: 'barbearia-estilo-vivo',
        name: 'Barbearia Estilo Vivo',
        status: 'active',
        domains: {
          subdomain: 'estilo-vivo',
          customDomain: 'cliente.example.com',
        },
        seo: {
          title: 'Barbearia Estilo Vivo',
          description: 'Pagina publica',
        },
      },
      theme: baseTheme,
      sections: [
        {
          id: 'services-1',
          key: 'services',
          type: 'services',
          visible: true,
          items: [
            { id: 'service-with-image', name: 'Corte', imageUrl: 'https://cdn.example.com/corte.jpg' },
            { id: 'service-without-image', name: 'Barba' },
          ],
        },
      ],
      links: [],
      seo: {
        title: 'Barbearia Estilo Vivo',
        description: 'Pagina publica',
      },
    });

    expect(parsed.business.domains).toEqual({
      subdomain: 'estilo-vivo',
      customDomain: 'cliente.example.com',
    });
    expect(parsed.sections[0].items[0].imageUrl).toBe('https://cdn.example.com/corte.jpg');
    expect(parsed.sections[0].items[1].imageUrl).toBeUndefined();
  });
});
