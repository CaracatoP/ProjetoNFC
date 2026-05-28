import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchSession,
  getStoredSessionToken,
  loginSession,
  logoutSession,
  setStoredSessionToken,
} from '@/services/authService.js';

const AuthContext = createContext(null);
const CLIENT_BLOCKED_BILLING_STATUSES = new Set(['suspended', 'cancelled']);

function resolveHomePath(session) {
  const roleLevel = session?.user?.roleLevel ?? 5;
  return roleLevel <= 1 ? '/dashboard' : '/panel';
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredSessionToken());
  const [session, setSession] = useState(null);
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
        const nextSession = await fetchSession(token);

        if (!active) {
          return;
        }

        setSession(nextSession);
        setUser(nextSession.user);
        setStatus('authenticated');
        setError('');
      } catch (_error) {
        if (!active) {
          return;
        }

        setStoredSessionToken('');
        setToken('');
        setSession(null);
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
      session,
      user,
      business: session?.business || null,
      subscription: session?.subscription || null,
      access: session?.access || null,
      roleLevel: session?.user?.roleLevel ?? null,
      status,
      error,
      isAuthenticated: status === 'authenticated',
      isAdminUser: (session?.user?.roleLevel ?? 99) <= 1,
      isClientUser: (session?.user?.roleLevel ?? 99) >= 2,
      isSuspendedClientAccess: CLIENT_BLOCKED_BILLING_STATUSES.has(session?.access?.billingStatus || ''),
      homePath: resolveHomePath(session),
      login: async (credentials) => {
        setStatus('loading');
        setError('');

        try {
          const nextSession = await loginSession(credentials);
          setStoredSessionToken(nextSession.token);
          setToken(nextSession.token);
          setSession(nextSession);
          setUser(nextSession.user);
          setStatus('authenticated');
          return nextSession;
        } catch (loginError) {
          setStatus('guest');
          setError(loginError.message);
          throw loginError;
        }
      },
      refreshSession: async () => {
        if (!token) {
          return null;
        }

        const nextSession = await fetchSession(token);
        setSession(nextSession);
        setUser(nextSession.user);
        setStatus('authenticated');
        setError('');
        return nextSession;
      },
      logout: async () => {
        try {
          if (token) {
            await logoutSession(token);
          }
        } catch (_error) {
          // Logout local mesmo se a API falhar.
        } finally {
          setStoredSessionToken('');
          setToken('');
          setSession(null);
          setUser(null);
          setStatus('guest');
          setError('');
        }
      },
    }),
    [error, session, status, token, user],
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
