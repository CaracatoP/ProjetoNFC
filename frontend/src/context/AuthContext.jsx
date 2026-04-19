import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminSession,
  getStoredAdminToken,
  loginAdmin,
  logoutAdmin,
  setStoredAdminToken,
} from '@/services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredAdminToken());
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!token) {
        if (active) {
          setStatus('guest');
          setUser(null);
          setError('');
        }
        return;
      }

      try {
        const session = await fetchAdminSession(token);

        if (!active) {
          return;
        }

        setUser(session.user);
        setStatus('authenticated');
        setError('');
      } catch (_error) {
        if (!active) {
          return;
        }

        setStoredAdminToken('');
        setToken('');
        setUser(null);
        setStatus('guest');
        setError('Sua sessao expirou. Entre novamente para continuar.');
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      status,
      error,
      isAuthenticated: status === 'authenticated',
      login: async (credentials) => {
        setStatus('loading');
        setError('');

        try {
          const session = await loginAdmin(credentials);
          setStoredAdminToken(session.token);
          setToken(session.token);
          setUser(session.user);
          setStatus('authenticated');
          return session;
        } catch (loginError) {
          setStatus('guest');
          setError(loginError.message);
          throw loginError;
        }
      },
      logout: async () => {
        try {
          if (token) {
            await logoutAdmin(token);
          }
        } catch (_error) {
          // Logout local mesmo se a API falhar.
        } finally {
          setStoredAdminToken('');
          setToken('');
          setUser(null);
          setStatus('guest');
          setError('');
        }
      },
    }),
    [error, status, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }

  return context;
}
