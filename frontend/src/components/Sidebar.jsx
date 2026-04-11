import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/',          icon: '📊', label: 'Dashboard'  },
  { to: '/students',  icon: '👥', label: 'Students'   },
  { to: '/session',   icon: '🎥', label: 'Live Session'},
  { to: '/attendance',icon: '✅', label: 'Attendance' },
  { to: '/risk',      icon: '⚠️', label: 'Risk Report' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🎓</div>
        <div className="sidebar-logo-text">
          <h1>AICIS</h1>
          <p>Classroom Intelligence</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signed in as</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.username}</div>
          <div style={{ fontSize: 11, color: 'var(--accent-blue)' }}>{user?.role}</div>
        </div>
        <button className="btn btn-outline w-full" onClick={handleLogout}
          style={{ justifyContent: 'center' }}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
