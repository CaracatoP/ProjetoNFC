import { describe, expect, it } from 'vitest';
import { publicSitePayloadSchema } from '@shared/schemas/index.js';
import { buildTenantTheme } from '@shared/utils/theme.js';

const baseTheme = buildTenantTheme({
  backgroundColor: '#050509',
  cardColor: '#15111f',
  buttonHoverColor: '#241c31',
  primaryButtonColor: '#7c3aed',
  textColor: '#ffffff',
  accentColor: '#7c3aed',
  borderColor: '#2d2738',
  secondaryColor: '#ec4899',
});

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

  it('normalizes missing or partial wifi contact data into stable strings', () => {
    const missingWifiParsed = publicSitePayloadSchema.parse({
      business: {
        id: 'business-1',
        slug: 'acougue-central',
        name: 'Acougue Central',
        status: 'active',
        contact: {},
        seo: {
          title: 'Acougue Central',
          description: 'Pagina publica',
        },
      },
      theme: baseTheme,
      sections: [],
      links: [],
      seo: {
        title: 'Acougue Central',
        description: 'Pagina publica',
      },
    });

    const partialWifiParsed = publicSitePayloadSchema.parse({
      business: {
        id: 'business-2',
        slug: 'acougue-central-copy',
        name: 'Acougue Central Copy',
        status: 'active',
        contact: {
          wifi: {
            security: 'WPA',
          },
        },
        seo: {
          title: 'Acougue Central Copy',
          description: 'Pagina publica',
        },
      },
      theme: baseTheme,
      sections: [],
      links: [],
      seo: {
        title: 'Acougue Central Copy',
        description: 'Pagina publica',
      },
    });

    expect(missingWifiParsed.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });
    expect(partialWifiParsed.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });
  });
});
