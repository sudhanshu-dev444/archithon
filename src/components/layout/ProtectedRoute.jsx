import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  
  // If not logged in, allow demo navigation or redirect to login.
  // For hackathon evaluation/presentation, if authenticated is true we render Outlet;
  // if not, we can redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
