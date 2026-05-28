import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { RequireAuth } from './RequireAuth.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('RequireAuth', () => {
  it('redirects client users away from the admin dashboard route', async () => {
    useAuth.mockReturnValue({
      status: 'authenticated',
      isAuthenticated: true,
      isAdminUser: false,
      isClientUser: true,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAuth mode="admin">
                <div>Dashboard admin</div>
              </RequireAuth>
            }
          />
          <Route path="/panel" element={<div>Painel cliente</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Painel cliente')).toBeInTheDocument();
  });

  it('redirects admin users away from the client panel route', async () => {
    useAuth.mockReturnValue({
      status: 'authenticated',
      isAuthenticated: true,
      isAdminUser: true,
      isClientUser: false,
    });

    render(
      <MemoryRouter initialEntries={['/panel']}>
        <Routes>
          <Route
            path="/panel"
            element={
              <RequireAuth mode="client">
                <div>Painel cliente</div>
              </RequireAuth>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dashboard admin')).toBeInTheDocument();
  });
});
