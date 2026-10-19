import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./hooks/useTheme.js";
import { AuthProvider } from "./hooks/useAuth.js";
import { Header } from "./components/Header.js";
import { BottomNav } from "./components/BottomNav.js";
import { Footer } from "./components/Footer.js";
import { Skeleton } from "./components/Skeleton.js";
import { HomePage } from "./pages/HomePage.js";

// Route-level code splitting for secondary pages (Lighthouse 90+ performance)
const AuthPage = lazy(() => import("./pages/AuthPage.js").then((m) => ({ default: m.AuthPage })));
const BookingFlowPage = lazy(() =>
  import("./pages/BookingFlowPage.js").then((m) => ({ default: m.BookingFlowPage })),
);
const TrackingPage = lazy(() =>
  import("./pages/TrackingPage.js").then((m) => ({ default: m.TrackingPage })),
);
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage.js").then((m) => ({ default: m.HistoryPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage.js").then((m) => ({ default: m.NotFoundPage })),
);
const PartnerPage = lazy(() =>
  import("./pages/PartnerPage.js").then((m) => ({ default: m.PartnerPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteLoader: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "16px" }}>
    <Skeleton height="180px" borderRadius="var(--radius-lg)" />
    <Skeleton height="80px" borderRadius="var(--radius-lg)" />
    <Skeleton height="120px" borderRadius="var(--radius-lg)" />
  </div>
);

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class RouteErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "44px", marginBottom: "16px" }}>♻️</div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
            Something went wrong
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
            We encountered an issue loading this section.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="app-viewport">
              <Header />

              <main className="main-content">
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteLoader />}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/auth" element={<AuthPage />} />
                      <Route path="/book" element={<BookingFlowPage />} />
                      <Route path="/tracking/:id" element={<TrackingPage />} />
                      <Route path="/history" element={<HistoryPage />} />
                      <Route path="/partner" element={<PartnerPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </RouteErrorBoundary>
              </main>

              <Footer />
              <BottomNav />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
