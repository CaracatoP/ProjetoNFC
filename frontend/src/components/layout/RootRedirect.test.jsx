import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { RootRedirect } from './RootRedirect.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

vi.mock('@/context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('RootRedirect', () => {
  it('redirects guests to /auth', async () => {
    useAuth.mockReturnValue({
      status: 'idle',
      isAuthenticated: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/auth" element={<div>Auth</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Auth')).toBeInTheDocument();
  });

  it('redirects authenticated users to /dashboard', async () => {
    useAuth.mockReturnValue({
      status: 'idle',
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });
});
