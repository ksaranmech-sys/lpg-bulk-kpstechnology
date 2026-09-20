import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';

// Each page is its own bundle so the login screen loads without the whole app.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const AdminOnboarding = lazy(() => import('./pages/AdminOnboarding'));
const DriverDetail = lazy(() => import('./pages/DriverDetail'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Suspense fallback={<div className="container"><p>Loading...</p></div>}>{children}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/vehicles/:vehicleId/*" element={<PrivateRoute><Navigate to="/" replace /></PrivateRoute>} />
          <Route path="/trips/:tripId" element={<PrivateRoute><TripDetail /></PrivateRoute>} />
          <Route path="/admin/onboarding" element={<PrivateRoute><AdminOnboarding /></PrivateRoute>} />
          <Route path="/customers/:customerId" element={<PrivateRoute><CustomerDetail /></PrivateRoute>} />
          <Route path="/drivers/:customerId/:driverId" element={<PrivateRoute><DriverDetail /></PrivateRoute>} />
          <Route path="/account/password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
          <Route path="*" element={<PrivateRoute><Navigate to="/" replace /></PrivateRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
