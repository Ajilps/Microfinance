import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Providers
import { AuthProvider } from './context/AuthContext';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import UserLayout from './layouts/UserLayout';
import AdminLayout from './layouts/AdminLayout';

// Route Guards
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import GuestRoute from './routes/GuestRoute';     // ← new: blocks login/register when logged in

// Route-level code splitting keeps the initial login bundle small.
const Login = lazy(() => import('./pages/Public/Login'));
const Register = lazy(() => import('./pages/Public/Register'));
const UserDashboard = lazy(() => import('./pages/User/Dashboard'));
const MyLoans = lazy(() => import('./pages/User/MyLoans'));
const MySavings = lazy(() => import('./pages/User/MySavings'));
const MyAttendance = lazy(() => import('./pages/User/MyAttendance'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const ManageUsers = lazy(() => import('./pages/Admin/ManageUsers'));
const ManageLoans = lazy(() => import('./pages/Admin/ManageLoans'));
const ManageSavings = lazy(() => import('./pages/Admin/ManageSavings'));
const ManageAttendance = lazy(() => import('./pages/Admin/ManageAttendance'));
const ManageReports = lazy(() => import('./pages/Admin/ManageReports'));

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
        />
        <Suspense fallback={<div className="spinner" aria-label="Loading page" />}>
          <Routes>
          {/* ── Public / Guest Routes ─────────────────────────────────────────
              GuestRoute prevents logged-in users from seeing login/register.
              If already authenticated, they are redirected to their dashboard.
          ─────────────────────────────────────────────────────────────────── */}
          <Route element={<GuestRoute />}>
            <Route element={<PublicLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
          </Route>

          {/* Root redirect: go to login for guests, dashboard for logged-in */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ── User Protected Routes ──────────────────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<UserLayout />}>
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/my-loans" element={<MyLoans />} />
              <Route path="/my-savings" element={<MySavings />} />
              <Route path="/my-attendance" element={<MyAttendance />} />
            </Route>
          </Route>

          {/* ── Admin Protected Routes ─────────────────────────────────────── */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<ManageUsers />} />
              <Route path="loans" element={<ManageLoans />} />
              <Route path="savings" element={<ManageSavings />} />
              <Route path="attendance" element={<ManageAttendance />} />
              <Route path="reports" element={<ManageReports />} />
            </Route>
          </Route>

          {/* ── 404 ────────────────────────────────────────────────────────── */}
          <Route
            path="*"
            element={
              <div style={{ padding: '5rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '4rem', color: '#e2e8f0' }}>404</h2>
                <p style={{ color: '#64748b' }}>Page not found.</p>
                <a href="/login" style={{ color: 'var(--primary-color)' }}>Go to Login</a>
              </div>
            }
          />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
};

export default App;
