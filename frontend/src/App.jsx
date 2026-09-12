import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripDetail from './pages/TripDetail';
import AdminOnboarding from './pages/AdminOnboarding';
import DriverDetail from './pages/DriverDetail';
import CustomerDetail from './pages/CustomerDetail';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/vehicles/:vehicleId/*" element={<PrivateRoute><Navigate to="/" replace /></PrivateRoute>} />
          <Route path="/trips/:tripId" element={<PrivateRoute><TripDetail /></PrivateRoute>} />
          <Route path="/admin/onboarding" element={<PrivateRoute><AdminOnboarding /></PrivateRoute>} />
          <Route path="/customers/:customerId" element={<PrivateRoute><CustomerDetail /></PrivateRoute>} />
          <Route path="/drivers/:customerId/:driverId" element={<PrivateRoute><DriverDetail /></PrivateRoute>} />
          <Route path="*" element={<PrivateRoute><Navigate to="/" replace /></PrivateRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
