import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { LibraryProvider } from '@/store/LibraryContext';
import { ToastProvider } from '@/store/ToastContext';
import { CardGridSkeleton } from '@/components/ui/Skeleton';
import HomePage from '@/pages/HomePage';

// Home ships in the main bundle; every other route is split.
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const AnimeDetailPage = lazy(() => import('@/pages/AnimeDetailPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const ReleasesPage = lazy(() => import('@/pages/ReleasesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function RouteFallback() {
  return (
    <div className="space-y-6" role="status" aria-label="Chargement">
      <div className="shimmer h-8 w-52 rounded-lg" />
      <CardGridSkeleton count={12} />
    </div>
  );
}

export default function App() {
  return (
    // Vite injects the deployment base here, so the same build works at the
    // domain root and under a sub-path like /kagami/.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LibraryProvider>
        <ToastProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
          >
            Aller au contenu
          </a>

          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route
                path="discover"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <DiscoverPage />
                  </Suspense>
                }
              />
              <Route
                path="library"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <LibraryPage />
                  </Suspense>
                }
              />
              <Route
                path="library/:status"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <LibraryPage />
                  </Suspense>
                }
              />
              <Route
                path="anime/:id"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AnimeDetailPage />
                  </Suspense>
                }
              />
              <Route
                path="releases"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ReleasesPage />
                  </Suspense>
                }
              />
              <Route
                path="calendar"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <CalendarPage />
                  </Suspense>
                }
              />
              <Route
                path="stats"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StatsPage />
                  </Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
              <Route
                path="*"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <NotFoundPage />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </ToastProvider>
      </LibraryProvider>
    </BrowserRouter>
  );
}
