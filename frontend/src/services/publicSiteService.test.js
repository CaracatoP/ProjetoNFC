import { getPublicSiteBySlug, resetPublicSiteCache } from './publicSiteService.js';
import { buildTenantTheme } from '@shared/utils/theme.js';

const baseTheme = buildTenantTheme({
  backgroundColor: '#140d09',
  cardColor: '#211410',
  buttonHoverColor: '#2b1d16',
  primaryButtonColor: '#f97316',
  textColor: '#fff8f2',
  accentColor: '#f97316',
  borderColor: '#4d372e',
  secondaryColor: '#fb7185',
});

describe('publicSiteService', () => {
  afterEach(() => {
    resetPublicSiteCache();
    vi.unstubAllGlobals();
  });

  it('preserves optional service images when parsing the public tenant payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            business: {
              id: 'business-1',
              slug: 'barbearia-estilo-vivo',
              name: 'Barbearia Estilo Vivo',
              status: 'active',
              hours: [],
              contact: {},
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
                title: 'Servicos',
                description: 'Catalogo',
                order: 30,
                visible: true,
                settings: {},
                items: [
                  {
                    id: 'service-1',
                    name: 'Corte masculino',
                    price: 45,
                    description: 'Corte classico',
                    imageUrl: 'https://cdn.example.com/services/corte.jpg',
                  },
                  {
                    id: 'service-2',
                    name: 'Barba',
                    price: 30,
                    description: 'Sem imagem',
                  },
                ],
              },
            ],
            links: [],
            seo: {
              title: 'Barbearia Estilo Vivo',
              description: 'Pagina publica',
            },
          },
        }),
      }),
    );

    const site = await getPublicSiteBySlug('barbearia-estilo-vivo');

    expect(site.sections[0].items).toEqual([
      expect.objectContaining({
        name: 'Corte masculino',
        imageUrl: 'https://cdn.example.com/services/corte.jpg',
      }),
      expect.objectContaining({
        name: 'Barba',
        imageUrl: undefined,
      }),
    ]);
  });

  it('deduplicates simultaneous public slug requests and reuses the cached payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          business: {
            id: 'business-1',
            slug: 'barbearia-estilo-vivo',
            name: 'Barbearia Estilo Vivo',
            status: 'active',
            hours: [],
            contact: {},
            seo: {
              title: 'Barbearia Estilo Vivo',
              description: 'Pagina publica',
            },
          },
          theme: baseTheme,
          sections: [],
          links: [],
          seo: {
            title: 'Barbearia Estilo Vivo',
            description: 'Pagina publica',
          },
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const [firstSite, secondSite] = await Promise.all([
      getPublicSiteBySlug('barbearia-estilo-vivo'),
      getPublicSiteBySlug('barbearia-estilo-vivo'),
    ]);
    const thirdSite = await getPublicSiteBySlug('barbearia-estilo-vivo');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstSite.business.slug).toBe('barbearia-estilo-vivo');
    expect(secondSite).toEqual(firstSite);
    expect(thirdSite).toEqual(firstSite);
  });

  it('bypasses the public cache for preview fetches and forwards preview query params to the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          business: {
            id: 'business-1',
            slug: 'barbearia-estilo-vivo',
            name: 'Barbearia Estilo Vivo',
            status: 'active',
            hours: [],
            contact: {},
            seo: {
              title: 'Barbearia Estilo Vivo',
              description: 'Pagina publica',
            },
          },
          theme: baseTheme,
          sections: [],
          links: [],
          seo: {
            title: 'Barbearia Estilo Vivo',
            description: 'Pagina publica',
          },
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    await getPublicSiteBySlug('barbearia-estilo-vivo');
    await getPublicSiteBySlug('barbearia-estilo-vivo', {
      preview: true,
      bypassCache: true,
      cacheBust: '1700000000000',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/public/site/barbearia-estilo-vivo?preview=1&t=1700000000000');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: expect.objectContaining({
        'Cache-Control': 'no-store',
      }),
    });
  });

  it('normalizes partial wifi payloads returned by the public tenant API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            business: {
              id: 'business-3',
              slug: 'acougue-central-copy',
              name: 'Acougue Central Copy',
              status: 'active',
              hours: [],
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
          },
        }),
      }),
    );

    const site = await getPublicSiteBySlug('acougue-central-copy');

    expect(site.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });
  });

  it('normalizes legacy public products without measurementUnit to unit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            business: {
              id: 'business-4',
              slug: 'acougue-central',
              name: 'Acougue Central',
              status: 'active',
              hours: [],
              contact: {},
              seo: {
                title: 'Acougue Central',
                description: 'Pagina publica',
              },
            },
            theme: baseTheme,
            sections: [],
            links: [],
            modulesData: {
              products: [
                {
                  id: 'product-1',
                  name: 'Picanha',
                  price: 59.9,
                  category: 'Carnes',
                },
              ],
            },
            seo: {
              title: 'Acougue Central',
              description: 'Pagina publica',
            },
          },
        }),
      }),
    );

    const site = await getPublicSiteBySlug('acougue-central');

    expect(site.modulesData.products[0].measurementUnit).toBe('unit');
  });
});
