import { act, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import * as authService from '@/services/authService.js';

vi.mock('@/services/authService.js', () => ({
  fetchSession: vi.fn(),
  getStoredSessionToken: vi.fn(),
  loginSession: vi.fn(),
  logoutSession: vi.fn(),
  setStoredSessionToken: vi.fn(),
}));

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="role">{auth.roleLevel ?? 'none'}</span>
      <span data-testid="billing">{auth.access?.billingStatus || 'none'}</span>
      <span data-testid="business">{auth.business?.id || 'none'}</span>
    </div>
  );
}

function setVisibilityState(value) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
}

describe('AuthContext', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    setVisibilityState('visible');
  });

  it('refreshes the authenticated session on a controlled interval', async () => {
    vi.useFakeTimers();
    setVisibilityState('visible');

    authService.getStoredSessionToken.mockReturnValue('session-token');
    authService.fetchSession
      .mockResolvedValueOnce({
        user: { id: 'user-1', roleLevel: 2 },
        business: { id: 'business-1' },
        access: { billingStatus: 'paid' },
        subscription: { plan: { code: 'pro' } },
      })
      .mockResolvedValueOnce({
        user: { id: 'user-1', roleLevel: 3 },
        business: { id: 'business-2' },
        access: { billingStatus: 'overdue' },
        subscription: { plan: { code: 'premium' } },
      });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('role')).toHaveTextContent('2');
    expect(screen.getByTestId('billing')).toHaveTextContent('paid');
    expect(screen.getByTestId('business')).toHaveTextContent('business-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });

    expect(authService.fetchSession).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('role')).toHaveTextContent('3');
    expect(screen.getByTestId('billing')).toHaveTextContent('overdue');
    expect(screen.getByTestId('business')).toHaveTextContent('business-2');
  });

  it('pauses session polling while the tab is hidden and refreshes when visibility returns', async () => {
    vi.useFakeTimers();
    setVisibilityState('visible');

    authService.getStoredSessionToken.mockReturnValue('session-token');
    authService.fetchSession
      .mockResolvedValueOnce({
        user: { id: 'user-1', roleLevel: 2 },
        business: { id: 'business-1' },
        access: { billingStatus: 'paid' },
        subscription: { plan: { code: 'pro' } },
      })
      .mockResolvedValueOnce({
        user: { id: 'user-1', roleLevel: 2 },
        business: { id: 'business-1' },
        access: { billingStatus: 'overdue' },
        subscription: { plan: { code: 'pro' } },
      });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });

    expect(authService.fetchSession).toHaveBeenCalledTimes(1);

    setVisibilityState('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(authService.fetchSession).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('billing')).toHaveTextContent('overdue');
  });
});
