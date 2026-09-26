import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatMonthLabel, monthKey } from '@kps/shared';
import { Button, Card, ErrorText, Loading, Muted, Row, Select } from '../../ui';
import { SectionTitle } from '../../trip/common';
import { spacing } from '../../theme';

export const formatRs = (value) => `Rs ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

export const expenseVehicleId = (expense) => String(expense.vehicle?._id || expense.vehicle || '');

// Port of the web VehicleExpensesSection: pick a vehicle, one row per expense month, yearly totals.
export default function VehicleExpensesCard({ customerId, vehicles, driverUsers = [], expenses, loading, error }) {
  const router = useRouter();
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const vehicleId = selectedVehicleId && vehicles.some((vehicle) => String(vehicle._id) === selectedVehicleId)
    ? selectedVehicleId
    : String(vehicles[0]?._id || '');
  const vehicle = vehicles.find((entry) => String(entry._id) === vehicleId);
  const driver = driverUsers.find((entry) => String(entry.vehicle) === vehicleId);

  const years = useMemo(() => {
    const months = {};
    expenses.forEach((expense) => {
      if (expenseVehicleId(expense) !== vehicleId) return;
      const key = monthKey(expense.date);
      if (!key) return;
      const entry = months[key] || (months[key] = { key, total: 0, categories: new Set() });
      entry.total += Number(expense.amount) || 0;
      if (expense.category) entry.categories.add(expense.category);
    });
    const byYear = {};
    Object.values(months).forEach((entry) => {
      const year = entry.key.slice(0, 4);
      (byYear[year] || (byYear[year] = [])).push(entry);
    });
    return Object.entries(byYear)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, list]) => ({
        year,
        months: list.sort((a, b) => b.key.localeCompare(a.key)),
        total: list.reduce((sum, entry) => sum + entry.total, 0),
      }));
  }, [expenses, vehicleId]);

  const currentYear = String(new Date().getFullYear());
  const currentYearTotal = years.find((entry) => entry.year === currentYear)?.total || 0;

  return (
    <Card title="Vehicle Expenses">
      <Select
        label="Vehicle Number"
        value={vehicleId}
        options={vehicles.map((entry) => ({ value: String(entry._id), label: entry.vehicleNumber }))}
        onChange={(next) => { if (next) setSelectedVehicleId(next); }}
        placeholder="No vehicles found"
      />
      <Row label={`Total ${currentYear}`} value={formatRs(currentYearTotal)} bold />
      <ErrorText>{error}</ErrorText>
      {loading ? <Loading text="Loading vehicle expenses..." /> : !vehicle ? null : years.length === 0 ? (
        <Muted style={{ marginTop: spacing.sm }}>No vehicle expenses recorded for {vehicle.vehicleNumber}.</Muted>
      ) : years.map(({ year, months, total }) => (
        <View key={year} style={{ marginTop: spacing.md }}>
          {months.map((entry) => (
            <Row
              key={entry.key}
              label={`${formatMonthLabel(entry.key)}\n${Array.from(entry.categories).join(', ')}`}
              value={formatRs(entry.total)}
            />
          ))}
          <Row label={`Total ${year}`} value={formatRs(total)} bold />
        </View>
      ))}
      {vehicle && (
        <View style={{ marginTop: spacing.md }}>
          <SectionTitle>Driver: {driver ? (driver.displayName || driver.name || driver.username) : 'Unassigned'}</SectionTitle>
          {driver ? (
            <Button
              title="Add / edit expenses on driver page"
              variant="secondary"
              onPress={() => router.push(`/drivers/${customerId}/${driver.id || driver._id}`)}
            />
          ) : <Muted>Assign a driver to manage this vehicle's expenses.</Muted>}
        </View>
      )}
    </Card>
  );
}
