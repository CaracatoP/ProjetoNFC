import { Navigate } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export function RootRedirect() {
  const { status, isAuthenticated, homePath } = useAuth();

  if (status === 'loading') {
    return <EmptyState title="Carregando acesso" description="Verificando a sessao do painel." />;
  }

  return <Navigate to={isAuthenticated ? homePath : '/auth'} replace />;
}
