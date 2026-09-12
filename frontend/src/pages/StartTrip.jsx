import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';

export default function StartTrip() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    api.getVehicle(vehicleId).then(async (res) => {
      const currentVehicle = res.data.vehicle;
      setVehicle(currentVehicle);
      if (!currentVehicle.driverName || started.current) return;
      started.current = true;
      setCreating(true);
      try {
        const trip = await api.createTrip(vehicleId, {});
        navigate(`/trips/${trip.data.trip._id}`);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to start trip');
        setCreating(false);
      }
    });
  }, [vehicleId]);

  return (
    <Layout>
      <Link to={`/vehicles/${vehicleId}`}>&larr; Back to vehicle</Link>
      <h2 className="section-title" style={{ marginTop: 12 }}>Trip Details</h2>
      {vehicle && <p style={{ color: '#666' }}>{vehicle.vehicleNumber} | Driver: {vehicle.driverName || 'Not assigned'}</p>}

      {!vehicle ? <p>Loading...</p> : !vehicle.driverName ? (
        <p className="error-text">Assign a driver to this vehicle before starting a trip.</p>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          {creating && <p style={{ color: '#666', margin: 0 }}>Opening trip entry...</p>}
          {creating && <p style={{ color: '#666' }}>Starting trip...</p>}
          {error && <div className="error-text">{error}</div>}
        </div>
      )}
    </Layout>
  );
}