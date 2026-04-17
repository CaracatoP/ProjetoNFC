import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext.jsx';
import { TenantProvider } from '@/context/TenantContext.jsx';
import { RequireAuth } from '@/components/layout/RequireAuth.jsx';
import { DashboardHomePage } from '@/pages/dashboard/DashboardHomePage.jsx';
import { AuthLandingPage } from '@/pages/auth/AuthLandingPage.jsx';
import { HomePage } from '@/pages/public/HomePage.jsx';
import { PublicSitePage } from '@/pages/public/PublicSitePage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/site/:slug" element={<PublicSitePage />} />
            <Route path="/auth/*" element={<AuthLandingPage />} />
            <Route
              path="/dashboard/*"
              element={
                <RequireAuth>
                  <DashboardHomePage />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </TenantProvider>
    </AuthProvider>
  );
}
