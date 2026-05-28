import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthLandingPage } from './AuthLandingPage.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('AuthLandingPage', () => {
  it('submits admin credentials to the auth service', async () => {
    const login = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({
      login,
      status: 'guest',
      error: '',
      isAuthenticated: false,
      homePath: '/dashboard',
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <Routes>
          <Route path="/auth" element={<AuthLandingPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('E-mail de acesso')).toHaveValue('');
    await user.type(screen.getByLabelText('E-mail de acesso'), 'admin@example.test');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-teste');
    await user.click(screen.getByRole('button', { name: /Entrar no painel/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'admin@example.test',
        password: 'senha-forte-teste',
      });
    });
  });

  it('redirects authenticated client users to their panel home', async () => {
    useAuth.mockReturnValue({
      login: vi.fn(),
      status: 'authenticated',
      error: '',
      isAuthenticated: true,
      homePath: '/panel',
    });

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <Routes>
          <Route path="/auth" element={<AuthLandingPage />} />
          <Route path="/panel" element={<div>Painel do cliente</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Painel do cliente')).toBeInTheDocument();
  });
});
