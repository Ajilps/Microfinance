import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import AuthContext from '../context/auth-context';

/**
 * GuestRoute — only accessible when NOT logged in.
 * If logged in: redirect admin → /admin/dashboard, user → /dashboard.
 * This prevents going back to login/register after authentication.
 */
const GuestRoute = () => {
  const { isAuthenticated, user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    // Redirect to appropriate dashboard
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default GuestRoute;
