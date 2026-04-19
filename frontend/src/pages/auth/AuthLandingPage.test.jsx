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

    expect(screen.getByLabelText('E-mail administrativo')).toHaveValue('');
    await user.type(screen.getByLabelText('E-mail administrativo'), 'joaogabrielcaracato@gmail.com');
    await user.type(screen.getByLabelText('Senha'), 'Jo@o240107');
    await user.click(screen.getByRole('button', { name: /Entrar no painel/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'joaogabrielcaracato@gmail.com',
        password: 'Jo@o240107',
      });
    });
  });
});
