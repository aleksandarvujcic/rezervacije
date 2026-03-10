import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '@mantine/core';
import { useAuthStore } from './stores/authStore';
import { useSSE } from './hooks/useSSE';
import { LoginPage } from './pages/LoginPage';
import { FloorPlanPage } from './pages/FloorPlanPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { AdminPage } from './pages/AdminPage';
import { onAuthError } from './api/client';

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
    <>
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
    </>
  );
}
