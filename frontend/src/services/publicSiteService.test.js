import { getPublicSiteBySlug } from './publicSiteService.js';
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
});
