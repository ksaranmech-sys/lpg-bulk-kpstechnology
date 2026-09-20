import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { api, errorMessage } from '../../../src/api';
import { Card, ErrorText, Loading, Muted, NavRow, Screen, Select } from '../../../src/ui';

// Admin vehicle list. Super admin filters by customer (VehicleFilter semantics: nothing selected
// shows no vehicles, "All vehicles" lists everything).
export default function VehiclesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(isSuper ? '' : 'all');
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSuper) return;
    api.listCustomers()
      .then((res) => setCustomers(res.data.customers || []))
      .catch((err) => setError(errorMessage(err, 'Failed to load customers')));
  }, [isSuper]);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!selectedCustomerId) {
      setVehicles([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError('');
    api.listVehicles(isSuper && selectedCustomerId !== 'all' ? selectedCustomerId : undefined)
      .then((res) => { if (active) setVehicles(res.data.vehicles || []); })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedCustomerId, isSuper]));

  return (
    <Screen>
      {isSuper && (
        <Card>
          <Select
            label="Filter Vehicles by Customer"
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
            options={[{ value: 'all', label: 'All vehicles' }, ...customers.map((c) => ({ value: c._id, label: c.companyName }))]}
            placeholder="Loading customers..."
          />
          <Muted>Vehicles: {!selectedCustomerId ? '-' : loading ? '...' : vehicles.length}</Muted>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
      <Card title={isSuper ? 'Vehicles' : 'Your Vehicles'}>
        {loading ? <Loading /> : null}
        {!loading && isSuper && !selectedCustomerId ? <Muted>Select a customer to view vehicles.</Muted> : null}
        {!loading && selectedCustomerId && vehicles.length === 0 ? <Muted>No vehicles found.</Muted> : null}
        {!loading && vehicles.map((vehicle) => (
          <NavRow
            key={vehicle._id}
            title={vehicle.vehicleNumber}
            subtitle={`${vehicle.customerName ? `${vehicle.customerName} \u00b7 ` : ''}Driver: ${vehicle.driverName || 'Not assigned'}`}
            onPress={() => router.push(`/vehicles/${vehicle._id}`)}
          />
        ))}
      </Card>
    </Screen>
  );
}
