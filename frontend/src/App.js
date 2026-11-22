import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CopilotProvider } from './context/CopilotContext';
import AppLayout from './components/layout/AppLayout';

import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import FinancePage from './pages/FinancePage';
import NutritionPage from './pages/NutritionPage';
import FitnessPage from './pages/FitnessPage';
import HabitsPage from './pages/HabitsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

// Protected Route Guard
function ProtectedRoute({ children, title }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-electric-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout title={title}>{children}</AppLayout>;
}

// Root Route handler
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CopilotProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Core Application Pages */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute title="Personal Overview">
                  <OverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance"
              element={
                <ProtectedRoute title="Finance Management">
                  <FinancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nutrition"
              element={
                <ProtectedRoute title="Nutrition Intelligence">
                  <NutritionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fitness"
              element={
                <ProtectedRoute title="Fitness & Strength">
                  <FitnessPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/habits"
              element={
                <ProtectedRoute title="Habits & Lifestyle">
                  <HabitsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute title="Life Analytics">
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute title="Settings & Goals">
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Backward compatibility redirects */}
            <Route path="/chart" element={<Navigate to="/finance" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </CopilotProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
