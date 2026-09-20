import React from 'react';
import { View } from 'react-native';
import { formatDate } from '@kps/shared';
import { Checkbox, Muted, Row } from '../../ui';
import { SectionTitle } from '../../trip/common';
import { colors, spacing } from '../../theme';

const rs = (value) => `Rs ${Math.round(Number(value) || 0)}`;

// Port of SalaryTripsTable: one block per trip plus the totals; the Closed checkbox force-closes.
export function SalaryTrips({ trips, closingTripId, onCloseTrip, totals }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {(trips || []).length === 0 ? <Muted>No trips for this month.</Muted> : null}
      {(trips || []).map((trip, index) => (
        <View key={trip._id || index} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}>
          <Row label={`${index + 1}. Loading`} value={`${trip.loadingLocation || '-'} (${trip.loadingDate ? formatDate(trip.loadingDate) : '-'})`} bold />
          <Row label="Unloading" value={`${trip.unloadingLocation || '-'} (${trip.unloadingDate ? formatDate(trip.unloadingDate) : '-'})`} />
          <Row label="Divert Location" value={trip.isDiverted ? trip.divertUnloadingLocation || '-' : '-'} />
          <Row label="Driver KM" value={trip.corporationKm != null && trip.corporationKm > 0 ? `${Math.round(trip.corporationKm)} km` : '-'} />
          <Row label="Diesel (Litres)" value={`${trip.dieselLitres ?? 0} L`} />
          <Row label="Trip Diesel" value={`Rs ${trip.dieselTotal ?? 0}`} />
          <Row label="Trip Advance" value={`Rs ${trip.advanceTotal ?? 0}`} />
          <Row label="Trip Expense" value={`Rs ${trip.expenseTotal ?? 0}`} />
          <Row label="Trip balance" value={`Rs ${trip.balance ?? 0}`} />
          <Checkbox
            label={trip.status === 'closed' ? 'Closed' : (closingTripId === trip._id ? 'Closing...' : 'Mark this trip as closed')}
            checked={trip.status === 'closed'}
            disabled={trip.status === 'closed' || closingTripId === trip._id}
            onChange={() => onCloseTrip(trip._id)}
          />
        </View>
      ))}
      <SectionTitle>Total</SectionTitle>
      <Row label="Driver KM" value={`${Math.round(totals.corporationKm || 0)} km`} bold />
      <Row label="Diesel (Litres)" value={`${totals.totalDieselLitres || 0} L`} bold />
      <Row label="Trip Diesel" value={`Rs ${totals.totalDiesel}`} bold />
      <Row label="Trip Advance" value={`Rs ${totals.totalAdvance}`} bold />
      <Row label="Trip Expense" value={`Rs ${totals.totalExpense}`} bold />
      <Row label="Trip balance" value={`Rs ${totals.totalBalance}`} bold />
    </View>
  );
}

// Port of SalarySummaryTable (regular and temporary driver share it).
export function SalarySummary({ salary }) {
  const subTotal = (salary.basicSalary || 0) + (salary.kmBeta || 0) + (salary.specialTripCharges || 0) + (salary.totalExpense || 0);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Row
        label={salary.payableDays != null
          ? `Basic salary (Payable days: ${salary.payableDays}, Leaves taken: ${salary.unpaidLeaveDays})`
          : `Basic salary (Days covered: ${salary.days})`}
        value={rs(salary.basicSalary)}
      />
      <Row label={`KM Beta (Total Driver KM ${Math.round(salary.corporationKm || 0)} x Rs ${salary.kmCharges || 0})`} value={rs(salary.kmBeta)} />
      {Number(salary.specialTripCharges || 0) > 0 && (
        <Row label={`Special Trip Charges (${salary.specialTripCount || 0} trips x Rs 1000)`} value={rs(salary.specialTripCharges)} />
      )}
      <Row label={`Total Expenses (${salary.closedTrips} trips)`} value={rs(salary.totalExpense)} />
      <Row label="Sub Total" value={rs(subTotal)} bold />
      <Row label={`Total Advance (${salary.closedTrips} trips)`} value={rs(salary.totalAdvance)} />
      <Row label="Settlement" value={rs(salary.salaryBalance)} bold />
    </View>
  );
}
