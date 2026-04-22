import { getPublicSiteBySlug } from './publicSiteService.js';

const baseTheme = {
  colors: {
    primary: '#f97316',
    secondary: '#fb7185',
    background: '#140d09',
    surface: '#211410',
    text: '#fff8f2',
    textMuted: '#f4d5c3',
    border: 'rgba(255,255,255,.12)',
  },
  typography: {
    headingFamily: "'Space Grotesk', sans-serif",
    bodyFamily: "'Manrope', sans-serif",
    baseSize: '16px',
    heroSize: '4rem',
    sectionTitleSize: '2rem',
  },
  spacing: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px' },
  radius: { sm: '8px', md: '16px', lg: '24px', pill: '999px' },
  layout: { maxWidth: '1180px', pagePadding: '24px', sectionGap: '24px', cardGap: '16px' },
  buttons: {
    primary: { background: '#f97316', color: '#ffffff' },
    secondary: { background: '#211410', color: '#fff8f2' },
  },
};

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
