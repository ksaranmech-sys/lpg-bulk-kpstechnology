import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [vehicleId, setVehicleId] = useState('');
  const [startingTrip, setStartingTrip] = useState(false);
  const [startTripError, setStartTripError] = useState('');

  useEffect(() => {
    if (user?.role !== 'vehicle_user') {
      setVehicleId('');
      return;
    }
    api.listVehicles()
      .then((res) => setVehicleId(res.data.vehicles?.[0]?._id || ''))
      .catch(() => setVehicleId(''));
  }, [user]);

  async function startTrip() {
    if (!vehicleId) return;
    setStartingTrip(true);
    setStartTripError('');
    try {
      const res = await api.createTrip(vehicleId, {});
      navigate(`/trips/${res.data.trip._id}`);
    } catch (err) {
      setStartTripError(err.response?.data?.error || 'Unable to start a trip. Please try again.');
    } finally {
      setStartingTrip(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
          <h1>KPS Technology — Fleet Management</h1>
        </Link>
        <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && <span style={{ fontSize: 13 }}>{user.name || user.username} ({user.role})</span>}
          {user?.role === 'super_admin' && (
            <Link to="/admin/onboarding" className="btn secondary topbar-action" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
              Create Customer
            </Link>
          )}
          {user?.role === 'vehicle_user' && (
            <button
              className="btn secondary"
              style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}
              onClick={startTrip}
              disabled={!vehicleId || startingTrip}
            >
              {startingTrip ? 'Starting...' : 'Start Trip'}
            </button>
          )}
          {user && (
            <button className="btn secondary topbar-action" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }} onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </div>
      {startTripError && <div className="error-text" style={{ margin: '12px 24px 0' }}>{startTripError}</div>}
      <div className="container">{children}</div>
    </div>
  );
}
