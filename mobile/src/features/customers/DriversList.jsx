import React from 'react';
import { useRouter } from 'expo-router';
import { formatDate } from '@kps/shared';
import { Button, Card, Muted, NavRow } from '../../ui';
import { spacing } from '../../theme';

const formatRs = (value) => `Rs ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

// Port of the web Vehicle & Driver List: one row per vehicle with its driver and this year's expenses.
export default function DriversList({ customerId, data, canAdd, vehicleExpenses = [] }) {
  const router = useRouter();
  const vehicles = data?.vehicles || [];
  const drivers = (data?.users || []).filter((item) => item.role === 'vehicle_user' && item.isActive !== false);
  const currentYear = new Date().getFullYear();
  const yearExpenseByVehicle = vehicleExpenses.reduce((acc, expense) => {
    if (new Date(expense.date).getFullYear() !== currentYear) return acc;
    const vehicleId = String(expense.vehicle?._id || expense.vehicle || '');
    acc[vehicleId] = (acc[vehicleId] || 0) + (Number(expense.amount) || 0);
    return acc;
  }, {});

  return (
    <Card
      title="Vehicle & Driver List"
      right={canAdd ? <Button title="Add Driver" onPress={() => router.push(`/drivers/new?customerId=${customerId}`)} style={{ minHeight: 36, paddingVertical: 6 }} /> : null}
    >
      {vehicles.length === 0 ? <Muted>No vehicles found.</Muted> : null}
      {vehicles.map((vehicle) => {
        const driver = drivers.find((entry) => String(entry.vehicle) === String(vehicle._id));
        const driverId = driver ? (driver.id || driver._id) : null;
        const driverLine = driver
          ? `${driver.displayName || driver.name || 'Unnamed driver'} | ${driver.mobileNumber || 'No phone'}\n${driver.username} | Joining Date: ${driver.joiningDate ? formatDate(driver.joiningDate) : 'Not set'}`
          : 'Unassigned vehicle';
        return (
          <NavRow
            key={vehicle._id}
            title={vehicle.vehicleNumber}
            subtitle={`Expenses ${currentYear}: ${formatRs(yearExpenseByVehicle[String(vehicle._id)])}\n${driverLine}`}
            onPress={driverId ? () => router.push(`/drivers/${customerId}/${driverId}`) : undefined}
          />
        );
      })}
      <Muted style={{ marginTop: spacing.sm }}>Tap a vehicle for the driver's salary, trips, leaves, expenses and reminders.</Muted>
    </Card>
  );
}
