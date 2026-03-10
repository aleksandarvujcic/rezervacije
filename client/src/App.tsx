import { useEffect, Component, type ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LoadingOverlay, Container, Title, Text, Button, Stack } from '@mantine/core';
import { useAuthStore } from './stores/authStore';
import { useSSE } from './hooks/useSSE';
import { LoginPage } from './pages/LoginPage';
import { FloorPlanPage } from './pages/FloorPlanPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { AdminPage } from './pages/AdminPage';
import { onAuthError } from './api/client';

// A2: Error Boundary — prevents total app crash in production
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container size="xs" py="xl" style={{ textAlign: 'center' }}>
          <Stack align="center" gap="md">
            <Title order={3}>Došlo je do greške</Title>
            <Text c="dimmed" size="sm">
              {this.state.error?.message || 'Neočekivana greška u aplikaciji.'}
            </Text>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.href = '/floor-plan';
              }}
            >
              Vrati se na početnu
            </Button>
          </Stack>
        </Container>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'manager' && user.role !== 'owner') {
    return <Navigate to="/floor-plan" replace />;
  }

  return <>{children}</>;
}

function AuthErrorHandler() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    onAuthError(() => {
      logout();
      navigate('/login', { replace: true });
    });
  }, [logout, navigate]);

  return null;
}

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useSSE();

  return (
    <ErrorBoundary>
      <AuthErrorHandler />
      <Routes>
        <Route path="/" element={<Navigate to="/floor-plan" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/floor-plan"
          element={
            <ProtectedRoute>
              <FloorPlanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reservations"
          element={
            <ProtectedRoute>
              <ReservationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ManagerRoute>
              <AdminPage />
            </ManagerRoute>
          }
        />
        <Route path="*" element={<Navigate to="/floor-plan" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
