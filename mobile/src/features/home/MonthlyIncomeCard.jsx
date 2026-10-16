import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDateLong, formatMonthLabel, monthKey, previousMonth } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, ErrorText, Loading, Muted, Row } from '../../ui';
import { colors, spacing } from '../../theme';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatMoney = (value) => (Number.isFinite(value) ? money.format(value) : 'NA');

function recentMonths() {
  const latest = previousMonth();
  const [year, month] = latest.split('-').map(Number);
  const previous = previousMonth(new Date(year, month - 1, 1));
  const [previousYear, previousMonthNumber] = previous.split('-').map(Number);
  return [latest, previous, previousMonth(new Date(previousYear, previousMonthNumber - 1, 1))];
}

function IncomeTotals({ title, totals }) {
  if (!totals) return null;
  return (
    <Card title={title} style={{ marginTop: spacing.sm, backgroundColor: '#f7fafc' }}>
      <Row label="Trip Income" value={formatMoney(totals.tripIncome)} />
      <Row label="Shortage" value={formatMoney(totals.shortage)} />
      <Row label="TDS" value={formatMoney(totals.tds)} />
      <Row label="Diesel" value={formatMoney(totals.diesel)} />
      <Row label="Amount" value={formatMoney(totals.amount)} bold />
      <Muted>{totals.pricedTrips} of {totals.trips} unloadings priced</Muted>
    </Card>
  );
}

export default function MonthlyIncomeCard({ customerId }) {
  const recent = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(recent[0]);
  const [showArchive, setShowArchive] = useState(false);
  const [income, setIncome] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customerId || !month) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    api.getCustomerMonthlyIncome(customerId, month)
      .then((res) => { if (active) setIncome(res.data); })
      .catch((err) => {
        if (!active) return;
        setIncome(null);
        setError(errorMessage(err, 'Failed to load monthly income'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId, month]);

  const isArchived = !recent.includes(month);
  function shiftArchiveMonth(amount) {
    const [year, monthNumber] = month.split('-').map(Number);
    setMonth(monthKey(new Date(year, monthNumber - 1 + amount, 1)));
  }

  return (
    <Card title={`Monthly Income (${formatMonthLabel(month)})${isArchived ? ' - Archived' : ''}`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
        {recent.map((key) => (
          <Text
            key={key}
            accessibilityRole="button"
            onPress={() => setMonth(key)}
            style={{
              color: key === month ? '#fff' : colors.green700,
              backgroundColor: key === month ? colors.green700 : colors.green100,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: 6,
              overflow: 'hidden',
              fontWeight: '700',
            }}
          >
            {formatMonthLabel(key)}
          </Text>
        ))}
      </View>
      <Muted style={{ marginBottom: spacing.md }}>
        Income for unloadings in this month, grouped by vehicle corporation, billing period and route state.
        IOC and HPC are split into half-month periods; corporation cut-off rules apply.
      </Muted>
      <ErrorText>{error}</ErrorText>
      {loading ? <Loading text="Loading monthly income..." /> : null}
      {!loading && income?.groups?.length === 0 ? <Muted>No unloadings in {formatMonthLabel(month)}.</Muted> : null}
      {!loading && income?.groups?.map((group) => (
        <Card key={group.vehicleCorporation} title={`${group.vehicleCorporation} (${group.totals.trips} unloadings)`} style={{ marginBottom: spacing.md }}>
          <Muted>
            {group.halfMonth ? 'Billed per half month' : 'Billed once a month'}
            {group.cutoffDay > 0 ? `; cut-off through day ${group.cutoffDay} of next month` : '; calendar-month cut-off'}
          </Muted>
          {group.periods.map((period) => (
            <Card key={period.key} title={`${period.label} (${period.totals.trips} unloadings)`} style={{ marginTop: spacing.sm }}>
              {period.states.length === 0 ? <Muted>No unloadings in this period.</Muted> : null}
              {period.states.map((state) => (
                <Card key={state.state} title={`${state.state} (${state.totals.trips} unloadings)`} style={{ marginTop: spacing.sm, backgroundColor: '#f7fafc' }}>
                  {state.rows.map((trip) => (
                    <View key={`${trip.tripId}-${trip.leg}`} style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <Text style={{ color: colors.ink, fontWeight: '700' }}>
                        {trip.sNo}. {trip.vehicleNumber || '-'}{trip.vehicleCorporation ? ` · ${trip.vehicleCorporation}` : ''}
                      </Text>
                      <Muted>{trip.loadingLocation || '-'} → {trip.unloadingLocation || '-'}</Muted>
                      {trip.leg === 'divert' ? <Muted>Divert (new unloading)</Muted> : null}
                      <Muted>Loading: {trip.loadingDate ? formatDateLong(trip.loadingDate) : '-'} · Unloading: {trip.unloadingDate ? formatDateLong(trip.unloadingDate) : '-'}</Muted>
                      <Row label="Trip Income" value={formatMoney(trip.tripIncome)} />
                      <Row label="Shortage" value={formatMoney(trip.shortage)} />
                      <Row label="TDS" value={formatMoney(trip.tds)} />
                      <Row label="Diesel" value={formatMoney(trip.diesel)} />
                      <Row label="Amount" value={formatMoney(trip.amount)} bold />
                    </View>
                  ))}
                  <IncomeTotals title={`Total ${state.state}`} totals={state.totals} />
                </Card>
              ))}
              {period.states.length > 1 ? <IncomeTotals title={`Total ${group.vehicleCorporation} - ${period.label}`} totals={period.totals} /> : null}
            </Card>
          ))}
          {group.periods.length > 1 ? <IncomeTotals title={`Total ${group.vehicleCorporation}`} totals={group.totals} /> : null}
        </Card>
      ))}
      {!loading && income?.groups?.length > 1 ? <IncomeTotals title="Total - all corporations" totals={income.totals} /> : null}
      <View style={{ borderTopWidth: 1, borderColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }}>
        <Text
          accessibilityRole="button"
          onPress={() => {
            if (showArchive) {
              setShowArchive(false);
              if (isArchived) setMonth(recent[0]);
            } else {
              setShowArchive(true);
              setMonth(recent[2]);
            }
          }}
          style={{ color: colors.green700, textAlign: 'right', textDecorationLine: 'underline', fontWeight: '700' }}
        >
          {showArchive ? 'Hide archived income' : 'View archived income'}
        </Text>
        {showArchive ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
            <Button title="Older month" variant="secondary" onPress={() => shiftArchiveMonth(-1)} />
            <Muted>{formatMonthLabel(month)}</Muted>
            <Button title="Newer month" variant="secondary" onPress={() => shiftArchiveMonth(1)} disabled={month >= recent[2]} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
