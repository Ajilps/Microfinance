import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import AuthContext from '../context/auth-context';

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useContext(AuthContext);

  if (loading) {
    // You could replace this with a proper loading spinner component
    return <div>Loading...</div>;
  }

  // If user is not authenticated, redirect to login page
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
