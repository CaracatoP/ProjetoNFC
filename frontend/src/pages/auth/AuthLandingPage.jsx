import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { AppShell } from '@/components/layout/AppShell.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export function AuthLandingPage() {
  const location = useLocation();
  const { login, status, error, isAuthenticated, homePath } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [localError, setLocalError] = useState('');

  const redirectTo = location.state?.from || homePath || '/dashboard';
  const submitting = status === 'loading';
  const visibleError = localError || error;

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLocalError('');

    if (!form.email.trim() || !form.password.trim()) {
      setLocalError('Informe e-mail e senha para entrar no painel.');
      return;
    }

    try {
      await login({
        email: form.email.trim(),
        password: form.password,
      });
    } catch (loginError) {
      setLocalError(loginError.message || 'Nao foi possivel iniciar a sessao no painel.');
    }
  }

  return (
    <AppShell
      eyebrow="TapLink"
      title="Painel de acesso ao seu tenant"
      description="Entre com um usuario autorizado para operar o TapLink com o nivel certo de acesso, plano resolvido e escopo seguro por tenant."
      shellClassName="dashboard-shell dashboard-shell--auth"
      heroClassName="dashboard-shell__hero"
      contentClassName="dashboard-shell__content"
      pageTitle="TapLink | Entrar"
    >
      <div className="admin-login-grid">
        <Card className="admin-panel-card admin-panel-card--hero">
          <div className="admin-panel-card__header">
            <div>
              <h2>Entrar no backoffice</h2>
              <p>Use seu e-mail e senha para entrar no painel TapLink com sessao segura e redirecionamento automatico por nivel.</p>
            </div>
          </div>

          <form className="admin-form admin-form--stack" onSubmit={handleSubmit}>
            <label className="admin-field">
              <span>E-mail de acesso</span>
              <input
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="seu-email@dominio.com"
              />
            </label>

            <label className="admin-field">
              <span>Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Sua senha de acesso"
              />
            </label>

            {visibleError ? <p className="admin-status-banner admin-status-banner--error">{visibleError}</p> : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar no painel'}
            </Button>
          </form>
        </Card>

        <Card className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>O que voce controla aqui</h2>
              <p>Fluxo desenhado para operacao assistida, sem depender do comercio editar a propria pagina.</p>
            </div>
          </div>

          <div className="admin-ranked-list">
            <div className="admin-ranked-item">
              <div>
                <strong>Onboarding rapido</strong>
                <span>Crie um tenant em poucos campos e refine depois no editor.</span>
              </div>
            </div>
            <div className="admin-ranked-item">
              <div>
                <strong>Conteudo e identidade visual</strong>
                <span>Edite descricao, links, servicos, galeria, SEO e tema visual.</span>
              </div>
            </div>
            <div className="admin-ranked-item">
              <div>
                <strong>Uploads preparados</strong>
                <span>Logo, banner e fotos sobem pelo backend e seguem para o Cloudinary com organizacao por tenant.</span>
              </div>
            </div>
            <div className="admin-ranked-item">
              <div>
                <strong>Analytics basico</strong>
                <span>Acompanhe page views, cliques e atividade recente por tenant.</span>
              </div>
            </div>
          </div>

          <p className="admin-muted-copy">
            O primeiro usuario admin pode ser bootstrapado pelo ambiente, mas depois fica persistido no banco para evoluir para multiplos acessos.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
