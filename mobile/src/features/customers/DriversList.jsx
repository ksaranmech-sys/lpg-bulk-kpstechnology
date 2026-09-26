import React from 'react';
import { useRouter } from 'expo-router';
import { formatDate } from '@kps/shared';
import { Button, Card, Muted, NavRow } from '../../ui';
import { colors, spacing } from '../../theme';

// Port of DriversTable: active drivers with vehicle, each opening the driver detail page.
export default function DriversList({ customerId, data, canAdd }) {
  const router = useRouter();
  const drivers = (data?.users || []).filter((item) => item.role === 'vehicle_user' && item.isActive !== false);
  const vehicleNumberOf = (driver) => data?.vehicles?.find((vehicle) => String(vehicle._id) === String(driver.vehicle))?.vehicleNumber || 'Unassigned';

  return (
    <Card
      title="Vehicle & Driver List"
      right={canAdd ? <Button title="Add Driver" onPress={() => router.push(`/drivers/new?customerId=${customerId}`)} style={{ minHeight: 36, paddingVertical: 6 }} /> : null}
    >
      {drivers.length === 0 ? <Muted>No drivers found.</Muted> : null}
      {drivers.map((driver) => {
        const driverId = driver.id || driver._id;
        return (
          <NavRow
            key={driverId}
            title={driver.displayName || driver.name || 'Unnamed driver'}
            subtitle={`${driver.username} | ${driver.mobileNumber || 'No phone'} | ${vehicleNumberOf(driver)}\nJoining Date: ${driver.joiningDate ? formatDate(driver.joiningDate) : 'Not set'}`}
            right={<Muted style={{ color: driver.isActive === false ? colors.muted : colors.success, fontWeight: '700' }}>{driver.isActive === false ? 'Inactive' : 'Active'}</Muted>}
            onPress={() => router.push(`/drivers/${customerId}/${driverId}`)}
          />
        );
      })}
      <Muted style={{ marginTop: spacing.sm }}>Tap a driver for salary, trips, leaves and reminders.</Muted>
    </Card>
  );
}
