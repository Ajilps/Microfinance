import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import AuthContext from '../context/auth-context';

const AdminRoute = () => {
  const { isAuthenticated, user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>Loading...</div>;
  }

  // Check if user is authenticated and is an admin
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && user.role !== 'admin') {
    // Redirect non-admins to user dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
