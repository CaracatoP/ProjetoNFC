import { Navigate, useLocation } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export function RequireAuth({ children }) {
  const location = useLocation();
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') {
    return <EmptyState title="Carregando painel" description="Validando sessao administrativa." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}
