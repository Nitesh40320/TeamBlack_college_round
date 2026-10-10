import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { LandingPage } from './pages/LandingPage';
import { NewAuditPage } from './pages/NewAuditPage';
import { AuditDetailPage } from './pages/AuditDetailPage';
import { HistoryPage } from './pages/HistoryPage';

// Lazy-load Evaluation Benchmark Page for bundle optimization
const EvaluationPage = lazy(() =>
  import('./pages/EvaluationPage').then((m) => ({ default: m.EvaluationPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-screen bg-[#0B0F19] text-slate-400 text-xs font-mono">
                  Loading Second Opinion...
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<LandingPage />} />
                  <Route path="new" element={<NewAuditPage />} />
                  <Route path="audit/:id" element={<AuditDetailPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="evaluation" element={<EvaluationPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
