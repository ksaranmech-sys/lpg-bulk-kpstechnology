import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatMonthLabel, monthKey } from '@kps/shared';
import { Card, ErrorText, Loading, Muted, Row, Select } from '../../ui';
import { SectionTitle } from '../../trip/common';
import { spacing } from '../../theme';
import DriverVehicleExpenses from './DriverVehicleExpenses';

export const formatRs = (value) => `Rs ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

export const expenseVehicleId = (expense) => String(expense.vehicle?._id || expense.vehicle || '');

// Port of the web VehicleExpensesSection: pick a vehicle, one row per expense month, yearly totals.
export default function VehicleExpensesCard({ customerId, vehicles, expenses, loading, error }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [manageExpenseError, setManageExpenseError] = useState('');
  const vehicleId = vehicles.some((vehicle) => String(vehicle._id) === selectedVehicleId)
    ? selectedVehicleId
    : '';
  const vehicle = vehicles.find((entry) => String(entry._id) === vehicleId);

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
        value={selectedVehicleId}
        options={vehicles.map((entry) => ({ value: String(entry._id), label: entry.vehicleNumber }))}
        onChange={setSelectedVehicleId}
        placeholder="Select vehicle"
        dropdown
      />
      {vehicle && <Row label={`Total ${currentYear}`} value={formatRs(currentYearTotal)} bold />}
      <ErrorText>{error}</ErrorText>
      {loading ? <Loading text="Loading vehicle expenses..." /> : !vehicle ? (
        <Muted>Select a vehicle to view and manage its expenses.</Muted>
      ) : years.length === 0 ? (
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
          <SectionTitle>Manage Expenses</SectionTitle>
          <ErrorText>{manageExpenseError}</ErrorText>
          <DriverVehicleExpenses customerId={customerId} vehicle={vehicle} setError={setManageExpenseError} />
        </View>
      )}
    </Card>
  );
}
