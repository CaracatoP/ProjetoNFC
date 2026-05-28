import { Navigate, useLocation } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export function RequireAuth({ children, mode = 'any' }) {
  const location = useLocation();
  const { status, isAuthenticated, isAdminUser, isClientUser } = useAuth();

  if (status === 'loading') {
    return <EmptyState title="Carregando painel" description="Validando sua sessao atual." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (mode === 'admin' && !isAdminUser) {
    return <Navigate to="/panel" replace />;
  }

  if (mode === 'client' && !isClientUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
