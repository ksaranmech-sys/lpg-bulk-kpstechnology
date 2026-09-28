import React from 'react';
import { useRouter } from 'expo-router';
import { formatDate } from '@kps/shared';
import { Button, Card, Muted, NavRow } from '../../ui';
import { spacing } from '../../theme';

const formatRs = (value) => `Rs ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

// Port of the web Vehicle & Driver List: one row per driver - vehicles can carry several drivers
// (one per date range) and drivers without a vehicle are listed at the end.
export default function DriversList({ customerId, data, canAdd, vehicleExpenses = [] }) {
  const router = useRouter();
  const vehicles = data?.vehicles || [];
  // Deactivated accounts stay listed (tagged) - they were the vehicle's driver for earlier dates.
  const drivers = (data?.users || []).filter((item) => item.role === 'vehicle_user');
  const vehicleIds = new Set(vehicles.map((vehicle) => String(vehicle._id)));
  const unassignedDrivers = drivers.filter((entry) => !entry.vehicle || !vehicleIds.has(String(entry.vehicle)));
  const currentYear = new Date().getFullYear();
  const yearExpenseByVehicle = vehicleExpenses.reduce((acc, expense) => {
    if (new Date(expense.date).getFullYear() !== currentYear) return acc;
    const vehicleId = String(expense.vehicle?._id || expense.vehicle || '');
    acc[vehicleId] = (acc[vehicleId] || 0) + (Number(expense.amount) || 0);
    return acc;
  }, {});
  const driverLine = (driver) => {
    const dates = `${driver.joiningDate ? formatDate(driver.joiningDate) : 'Not set'}${driver.resigningDate ? ` - ${formatDate(driver.resigningDate)}` : ''}`;
    const name = `${driver.displayName || driver.name || 'Unnamed driver'}${driver.isActive === false ? ' (inactive)' : ''}`;
    return `${name} | ${driver.mobileNumber || 'No phone'}\n${driver.username} | Joining Date: ${dates}`;
  };

  return (
    <Card
      title="Vehicle & Driver List"
      right={canAdd ? <Button title="Add Driver" onPress={() => router.push(`/drivers/new?customerId=${customerId}`)} style={{ minHeight: 36, paddingVertical: 6 }} /> : null}
    >
      {vehicles.length === 0 && unassignedDrivers.length === 0 ? <Muted>No vehicles or drivers found.</Muted> : null}
      {vehicles.map((vehicle) => {
        const vehicleDrivers = drivers
          .filter((entry) => String(entry.vehicle) === String(vehicle._id))
          .sort((a, b) => new Date(a.joiningDate || 0) - new Date(b.joiningDate || 0));
        const expenseLine = `Expenses ${currentYear}: ${formatRs(yearExpenseByVehicle[String(vehicle._id)])}`;
        if (!vehicleDrivers.length) {
          return <NavRow key={vehicle._id} title={vehicle.vehicleNumber} subtitle={`${expenseLine}\nUnassigned vehicle`} />;
        }
        return vehicleDrivers.map((driver, index) => {
          const driverId = driver.id || driver._id;
          return (
            <NavRow
              key={`${vehicle._id}-${driverId}`}
              title={vehicle.vehicleNumber}
              subtitle={`${index === 0 ? `${expenseLine}\n` : ''}${driverLine(driver)}`}
              onPress={() => router.push(`/drivers/${customerId}/${driverId}`)}
            />
          );
        });
      })}
      {unassignedDrivers.map((driver) => {
        const driverId = driver.id || driver._id;
        return (
          <NavRow
            key={`unassigned-${driverId}`}
            title="No vehicle"
            subtitle={driverLine(driver)}
            onPress={() => router.push(`/drivers/${customerId}/${driverId}`)}
          />
        );
      })}
      <Muted style={{ marginTop: spacing.sm }}>Tap a driver for the salary, trips, leaves, expenses and reminders.</Muted>
    </Card>
  );
}
