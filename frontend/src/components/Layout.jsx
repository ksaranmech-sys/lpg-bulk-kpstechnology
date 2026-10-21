import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleOdometer, setVehicleOdometer] = useState('');
  const [startOdometerKm, setStartOdometerKm] = useState('');
  const [startingTrip, setStartingTrip] = useState(false);
  const [showStartTripForm, setShowStartTripForm] = useState(false);
  const [startTripError, setStartTripError] = useState('');

  useEffect(() => {
    if (user?.role !== 'vehicle_user') {
      setVehicleId('');
      setVehicleOdometer('');
      return;
    }
    api.listVehicles()
      .then((res) => {
        const vehicle = res.data.vehicles?.[0];
        setVehicleId(vehicle?._id || '');
        setVehicleOdometer(vehicle?.lastKnownOdometer == null ? '' : String(vehicle.lastKnownOdometer));
      })
      .catch(() => setVehicleId(''));
  }, [user]);

  async function openStartTripForm() {
    setStartOdometerKm(vehicleOdometer);
    setStartTripError('');
    setShowStartTripForm(true);
    try {
      const res = await api.getVehicle(vehicleId);
      const currentOdometer = res.data.vehicle.lastKnownOdometer == null
        ? ''
        : String(res.data.vehicle.lastKnownOdometer);
      setVehicleOdometer(currentOdometer);
      setStartOdometerKm(currentOdometer);
    } catch (err) {
      setStartTripError(err.response?.data?.error || 'Failed to load the latest odometer reading');
    }
  }

  async function startTrip(event) {
    event.preventDefault();
    if (!vehicleId || startOdometerKm === '' || !Number.isFinite(Number(startOdometerKm)) || Number(startOdometerKm) < 0) {
      setStartTripError('Enter a valid odometer reading to start the trip.');
      return;
    }
    setStartingTrip(true);
    setStartTripError('');
    try {
      const res = await api.createTrip(vehicleId, { startOdometerKm: Number(startOdometerKm) });
      setShowStartTripForm(false);
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
          {user && <span style={{ fontSize: 13 }}>{user.displayName || user.name || user.username} ({user.role})</span>}
          {user && (
            <Link to="/account/password" className="btn secondary topbar-action" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
              Change Password
            </Link>
          )}
          {user?.role === 'super_admin' && (
            <Link to="/admin/onboarding" className="btn secondary topbar-action" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
              Create Customer
            </Link>
          )}
          {user?.role === 'vehicle_user' && (
            <button
              className="btn secondary"
              style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}
              onClick={openStartTripForm}
              disabled={!vehicleId || startingTrip}
            >
              Start Trip
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
      {showStartTripForm && (
        <div
          role="presentation"
          onClick={(event) => { if (event.target === event.currentTarget) setShowStartTripForm(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            background: 'rgba(0, 0, 0, 0.45)',
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-trip-title"
            className="card"
            onSubmit={startTrip}
            style={{ width: 'min(100%, 440px)', margin: 0 }}
          >
            <h2 id="start-trip-title" className="section-title" style={{ marginTop: 0 }}>Start Trip</h2>
            <div className="field">
              <label htmlFor="start-trip-odometer">Starting Odometer (km)</label>
              <input
                id="start-trip-odometer"
                type="number"
                min="0"
                step="1"
                value={startOdometerKm}
                onChange={(event) => setStartOdometerKm(event.target.value)}
                required
                autoFocus
              />
            </div>
            {startTripError && <p className="error-text">{startTripError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn secondary" onClick={() => setShowStartTripForm(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={startingTrip}>
                {startingTrip ? 'Starting...' : 'Confirm Start'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="container">{children}</div>
    </div>
  );
}
