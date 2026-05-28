import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchSession,
  getStoredSessionToken,
  loginSession,
  logoutSession,
  setStoredSessionToken,
} from '@/services/authService.js';

const AuthContext = createContext(null);
const CLIENT_BLOCKED_BILLING_STATUSES = new Set(['suspended', 'cancelled']);
const SESSION_REFRESH_INTERVAL_MS = 90_000;

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

  const applySession = useCallback((nextSession) => {
    setSession(nextSession);
    setUser(nextSession?.user || null);
    setStatus('authenticated');
    setError('');
    return nextSession;
  }, []);

  const clearSessionState = useCallback((nextError = '') => {
    setStoredSessionToken('');
    setToken('');
    setSession(null);
    setUser(null);
    setStatus('guest');
    setError(nextError);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) {
      return null;
    }

    try {
      const nextSession = await fetchSession(token);
      return applySession(nextSession);
    } catch (refreshError) {
      clearSessionState('Sua sessao expirou. Entre novamente para continuar.');
      throw refreshError;
    }
  }, [applySession, clearSessionState, token]);

  const login = useCallback(
    async (credentials) => {
      setStatus('loading');
      setError('');

      try {
        const nextSession = await loginSession(credentials);
        setStoredSessionToken(nextSession.token);
        setToken(nextSession.token);
        applySession(nextSession);
        return nextSession;
      } catch (loginError) {
        setStatus('guest');
        setError(loginError.message);
        throw loginError;
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      if (token) {
        await logoutSession(token);
      }
    } catch (_error) {
      // Logout local mesmo se a API falhar.
    } finally {
      clearSessionState('');
    }
  }, [clearSessionState, token]);

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

        applySession(nextSession);
      } catch (_error) {
        if (!active) {
          return;
        }

        clearSessionState('Sua sessao expirou. Entre novamente para continuar.');
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, [applySession, clearSessionState, token]);

  useEffect(() => {
    if (!token || status !== 'authenticated') {
      return undefined;
    }

    let intervalId = null;
    let active = true;
    let refreshing = false;

    const stopInterval = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const runRefresh = async () => {
      if (!active || refreshing || document.visibilityState === 'hidden') {
        return;
      }

      refreshing = true;

      try {
        await refreshSession();
      } catch {
        // O refreshSession ja aplica o fallback de sessao expirada.
      } finally {
        refreshing = false;
      }
    };

    const startInterval = () => {
      stopInterval();

      if (document.visibilityState !== 'hidden') {
        intervalId = window.setInterval(() => {
          void runRefresh();
        }, SESSION_REFRESH_INTERVAL_MS);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopInterval();
        return;
      }

      startInterval();
      void runRefresh();
    };

    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshSession, status, token]);

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
      login,
      refreshSession,
      logout,
    }),
    [error, login, logout, refreshSession, session, status, token, user],
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
