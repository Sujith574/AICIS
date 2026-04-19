import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/',                icon: '📊', label: 'Dashboard'        },
  { to: '/mark-attendance', icon: '📸', label: 'Mark Attendance', highlight: true },
  { to: '/students',        icon: '👥', label: 'Students'         },
  { to: '/attendance',      icon: '✅', label: 'Attendance Log'   },
  { to: '/session',         icon: '🎥', label: 'Live Session'     },
  { to: '/risk',            icon: '⚠️', label: 'Risk Report'      },
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
        {NAV.map(({ to, icon, label, highlight }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${highlight ? 'nav-highlight' : ''}`}
          >
            <span>{icon}</span>
            <span>{label}</span>
            {highlight && <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 700,
              background: 'var(--accent-green)', color: '#fff',
              padding: '2px 6px', borderRadius: 100,
            }}>NEW</span>}
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
