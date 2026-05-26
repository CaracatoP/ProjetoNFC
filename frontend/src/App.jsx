import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext.jsx';
import { TenantProvider } from '@/context/TenantContext.jsx';
import { RequireAuth } from '@/components/layout/RequireAuth.jsx';
import { RootRedirect } from '@/components/layout/RootRedirect.jsx';

const DashboardHomePage = lazy(() =>
  import('@/pages/dashboard/DashboardHomePage.jsx').then((module) => ({
    default: module.DashboardHomePage,
  })),
);
const AuthLandingPage = lazy(() =>
  import('@/pages/auth/AuthLandingPage.jsx').then((module) => ({
    default: module.AuthLandingPage,
  })),
);
const PublicSitePage = lazy(() =>
  import('@/pages/public/PublicSitePage.jsx').then((module) => ({
    default: module.PublicSitePage,
  })),
);

function AppRouteLoadingScreen() {
  return (
    <div className="site-loading-screen site-loading-screen--app" role="status" aria-live="polite">
      <div className="site-loading-screen__pulse" aria-hidden="true" />
      <strong>Carregando TapLink</strong>
      <span>Preparando a experiencia com o menor numero de recursos possivel no primeiro acesso.</span>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <BrowserRouter>
          <Suspense fallback={<AppRouteLoadingScreen />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
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
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TenantProvider>
    </AuthProvider>
  );
}
