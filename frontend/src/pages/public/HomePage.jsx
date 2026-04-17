import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { AppShell } from '@/components/layout/AppShell.jsx';
import { appConfig } from '@/config/appConfig.js';

export function HomePage() {
  return (
    <AppShell
      eyebrow="NFC Linktree SaaS"
      title="Base multi-tenant para paginas NFC white-label"
      description="Uma fundacao pronta para multiplos negocios, com renderizacao orientada por dados, tema por tenant e um backoffice interno para operacao recorrente."
    >
      <div className="marketing-grid">
        <Card className="marketing-card">
          <h2>Pagina publica por slug</h2>
          <p>Cada negocio possui identidade visual, conteudo, links, secoes e analytics proprios.</p>
          <Button href={`/site/${appConfig.demoSiteSlug}`}>
            Ver tenant de exemplo
          </Button>
        </Card>

        <Card className="marketing-card">
          <h2>Painel interno admin</h2>
          <p>Fluxo preparado para voce operar onboarding, edicao de conteudo, uploads e acompanhamento dos tenants.</p>
          <Button href="/auth" variant="secondary">
            Abrir painel interno
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
