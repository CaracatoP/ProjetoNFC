import { Navigate } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export function RootRedirect() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') {
    return <EmptyState title="Carregando acesso" description="Verificando a sessao administrativa." />;
  }

  return <Navigate to={isAuthenticated ? '/dashboard' : '/auth'} replace />;
}
