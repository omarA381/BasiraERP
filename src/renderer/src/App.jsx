import '../styles/global.css';

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore';
import DatabaseSetup from './screens/DatabaseSetup';
import Dashboard from './screens/Dashboard';
import Login from './screens/Login';
import FoundationDashboard from './screens/foundation/FoundationDashboard';
import UsersRoles from './screens/foundation/UsersRoles';
import AuditLogViewer from './screens/foundation/AuditLogViewer';
import WorkflowDesigner from './screens/foundation/WorkflowDesigner';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // Check DB config on startup (redirect to /setup if none found)
  useEffect(() => {
    window.electronAPI
      .loadDbConfig()
      .then((res) => {
        if (!res.success || !res.data) {
          setNeedsSetup(true);
        }
      })
      .catch(() => {
        setNeedsSetup(true);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-gray-500">Initializing NEXTERP...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes location={location}>
      {/* / → redirect based on state */}
      <Route
        path="/"
        element={
          needsSetup ? (
            <Navigate to="/setup" replace />
          ) : isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Public routes */}
      <Route path="/setup" element={<DatabaseSetup />} />
      <Route path="/login" element={<Login />} />

      {/* Protected routes (wrapped in AppShell) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/foundation" element={<FoundationDashboard />} />
          <Route path="/foundation/users-roles" element={<UsersRoles />} />
          <Route path="/foundation/audit-log" element={<AuditLogViewer />} />
          <Route path="/foundation/workflows" element={<WorkflowDesigner />} />
          <Route
            path="/foundation/*"
            element={
              <div className="flex h-full items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-medium">Foundation Module</p>
                  <p className="mt-1 text-sm">This section is under development</p>
                </div>
              </div>
            }
          />
          <Route
            path="/change-password"
            element={
              <div className="flex h-full items-center justify-center text-gray-400">
                Password change screen — coming soon
              </div>
            }
          />
        </Route>
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}