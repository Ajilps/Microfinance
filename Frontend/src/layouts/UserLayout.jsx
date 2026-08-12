import React, { useContext, useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import AuthContext from '../context/auth-context';
import Swal from 'sweetalert2';

const NAV_ITEMS = [
  { to: '/dashboard', icon: '⬡', label: 'Dashboard' },
  { to: '/my-loans', icon: '💳', label: 'My Loans' },
  { to: '/my-savings', icon: '🏦', label: 'My Savings' },
  { to: '/my-attendance', icon: '📋', label: 'Attendance' },
];

const UserLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You will be logged out of your session.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, logout!',
      background: '#1a1a1a',
      color: '#ffffff'
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
        navigate('/login', { replace: true });
      }
    });
  };

  const handleNavClick = () => { if (window.innerWidth <= 768) setSidebarOpen(false); };

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = (sidebarOpen && window.innerWidth <= 768) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const initials = user?.name ? user.name[0].toUpperCase() : 'U';

  return (
    <div className="layout-shell">

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`} aria-label="User navigation">

        <div className="sidebar-logo">
          <div className="sidebar-logo__icon" aria-hidden="true">
            <img src="/Icon.png" alt="" className="sidebar-logo__icon-img" />
          </div>
          <div>
            <div className="sidebar-logo__text">MicroFinance</div>
            <div className="sidebar-logo__badge">Member Portal</div>
          </div>
        </div>

        <nav className="sidebar-section" style={{ flex: 1, paddingTop: '1.25rem' }}>
          <div className="sidebar-section__label">My Account</div>
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={handleNavClick}
            >
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Click to logout"
          >
            <div className="sidebar-avatar" aria-hidden="true">{initials}</div>
            <div className="logout-text-wrapper">
              <span className="logout-label">Logout</span>
              <span className="logout-user-name">{user?.name || 'Member'}</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="layout-main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              className="hamburger"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>

          <div className="topbar__right">
            <div className="topbar__user">
              <div className="topbar-avatar" aria-hidden="true">{initials}</div>
              <span className="topbar__user-name">{user?.name || 'Member'}</span>
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>

    </div>
  );
};

export default UserLayout;
