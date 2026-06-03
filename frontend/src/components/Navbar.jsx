import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NAV_LINKS = [
  { to: '/',        label: 'Home' },
  { to: '/courses', label: 'Courses' },
  { to: '/plan',    label: 'Plan My Day' },
];

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav style={{
      background: '#fbfaee',
      borderBottom: '4px solid #181f21',
      padding: '0 40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 80,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Inner container — matches page-wrapper max-width for alignment */}
      <div style={{
        maxWidth: 1200, width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
      {/* Left: Logo + nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <NavLink to="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 28, fontWeight: 700,
            color: '#181f21', letterSpacing: '-0.02em',
          }}>
            learnr.
          </span>
        </NavLink>

        <div style={{ display: 'flex', gap: 0 }}>
          {NAV_LINKS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <span
                  className="nav-tab"
                  style={isActive ? {
                    color: '#181f21',
                    borderBottom: '2px solid #181f21',
                    paddingBottom: 6,
                  } : {}}
                >
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Right: Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavLink to="/profile" style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '6px 12px',
              background: isActive ? '#d0e3c1' : 'transparent',
              border: isActive ? '2px solid #181f21' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#d0e3c1'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Square avatar */}
              <div style={{
                width: 32, height: 32,
                border: '2px solid #181f21',
                background: '#d0e3c1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: '#181f21',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                {(user?.name || 'U')[0].toUpperCase()}
              </div>
              <span className="nav-tab" style={{
                padding: 0, border: 'none',
                color: isActive ? '#181f21' : '#434749',
                fontWeight: 700,
              }}>
                {user?.name?.split(' ')[0] || 'Profile'}
              </span>
            </div>
          )}
        </NavLink>
      </div>
      </div>
    </nav>
  );
}
