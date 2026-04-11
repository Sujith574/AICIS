import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar    from './components/Sidebar';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Students   from './pages/Students';
import Session    from './pages/Session';
import Attendance from './pages/Attendance';
import Risk       from './pages/Risk';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-overlay" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
      <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2235',
              color: '#f0f4ff',
              border: '1px solid #1e2d45',
              borderRadius: 8,
              fontSize: 14,
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/students"  element={<Students />} />
            <Route path="/session"   element={<Session />} />
            <Route path="/attendance"element={<Attendance />} />
            <Route path="/risk"      element={<Risk />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
