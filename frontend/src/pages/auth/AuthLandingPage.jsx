import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { AppShell } from '@/components/layout/AppShell.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export function AuthLandingPage() {
  const location = useLocation();
  const { login, status, error, isAuthenticated } = useAuth();
  const [form, setForm] = useState({
    username: '',
    password: '',
  });
  const [localError, setLocalError] = useState('');

  const redirectTo = location.state?.from || '/dashboard';
  const submitting = status === 'loading';
  const visibleError = localError || error;

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLocalError('');

    if (!form.username.trim() || !form.password.trim()) {
      setLocalError('Informe usuario e senha para entrar no painel.');
      return;
    }

    try {
      await login({
        username: form.username.trim(),
        password: form.password,
      });
    } catch (loginError) {
      setLocalError(loginError.message || 'Nao foi possivel iniciar a sessao administrativa.');
    }
  }

  return (
    <AppShell
      eyebrow="Operacao Interna"
      title="Painel admin para gerenciar tenants"
      description="Acesso reservado para sua operacao. Cadastre novos comercios, ajuste conteudo, suba imagens e acompanhe analytics em um unico fluxo."
      shellClassName="dashboard-shell dashboard-shell--auth"
      heroClassName="dashboard-shell__hero"
      contentClassName="dashboard-shell__content"
    >
      <div className="admin-login-grid">
        <Card className="admin-panel-card admin-panel-card--hero">
          <div className="admin-panel-card__header">
            <div>
              <h2>Entrar no backoffice</h2>
              <p>Use as credenciais administrativas configuradas no backend para abrir o painel interno.</p>
            </div>
          </div>

          <form className="admin-form admin-form--stack" onSubmit={handleSubmit}>
            <label className="admin-field">
              <span>Usuario</span>
              <input
                autoComplete="username"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
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
                placeholder="Sua senha administrativa"
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
                <span>Logo, banner e fotos sobem agora localmente com caminho pronto para storage cloud.</span>
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
            Use as credenciais administrativas configuradas no backend. Se quiser trocar isso depois, basta ajustar `ADMIN_USERNAME` e `ADMIN_PASSWORD` no ambiente.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
