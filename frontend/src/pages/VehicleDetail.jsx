import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export default function VehicleDetail() {
  const { vehicleId } = useParams();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState('');

  function load() {
    api.getVehicle(vehicleId).then((res) => setVehicle(res.data.vehicle));
    api.listTripsForVehicle(vehicleId).then((res) => setTrips(res.data.trips));
  }

  useEffect(load, [vehicleId]);

  async function handleDeleteTrip(tripId) {
    if (!window.confirm('Delete this trip history entry?')) return;
    try {
      await api.deleteTrip(tripId);
      setTrips((current) => current.filter((trip) => trip._id !== tripId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete trip');
    }
  }

  return (
    <Layout>
      <Link to="/">&larr; Back to vehicles</Link>
      <h2 className="section-title" style={{ marginTop: 12 }}>
        {vehicle ? vehicle.vehicleNumber : 'Loading...'}
      </h2>
      {vehicle && (
        <p style={{ color: '#666', marginTop: -4 }}>
          {vehicle.customerName || 'No customer'} | Driver: {vehicle.driverName || 'Not assigned'}
          {vehicle.driverMobile ? ` | Phone: ${vehicle.driverMobile}` : ''}
        </p>
      )}
      {error && <div className="error-text">{error}</div>}

      <h3 className="section-title" style={{ marginTop: 24 }}>Trip History</h3>
      {trips.map((t) => (
        <div key={t._id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Link to={`/trips/${t._id}`} style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
            <div>
              <strong>{t.loadingLocation}</strong> &rarr; {t.unloadingLocation || 'in progress'}
              <div style={{ fontSize: 12, color: '#666' }}>
                {new Date(t.createdAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${t.status}`}>{t.status}</span>
            {t.status === 'open' && (
              <Link className="btn secondary" to={`/trips/${t._id}`}>
                Edit
              </Link>
            )}
            {['super_admin', 'customer_admin'].includes(user?.role) && (
              <button className="btn danger" onClick={() => handleDeleteTrip(t._id)}>
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </Layout>
  );
}
