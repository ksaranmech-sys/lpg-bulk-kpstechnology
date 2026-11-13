import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { currentMonth, formatDateLong, formatMonthLabel, monthKey } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, ErrorText, Loading, Muted, Select } from '../../ui';
import { spacing } from '../../theme';
import { buildMonthlyIncomeHtml } from './monthlyIncomePdf';

const money = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value) => (Number.isFinite(value) ? money.format(value) : 'NA');

function selectableMonths(today = new Date()) {
  return Array.from({ length: 36 }, (_, index) => (
    monthKey(new Date(today.getFullYear(), today.getMonth() - index, 1))
  ));
}

const columns = [
  { key: 'sNo', label: 'S.No', width: 58 },
  { key: 'vehicleNumber', label: 'Vehicle Number', width: 126 },
  { key: 'loadingLocation', label: 'Loading Location', width: 150 },
  { key: 'unloadingLocation', label: 'Unloading Location', width: 150 },
  { key: 'loadingDate', label: 'Loading Date', width: 112 },
  { key: 'loadingWeightTons', label: 'Load Weight (tons)', width: 112 },
  { key: 'unloadingDate', label: 'Unloading Date', width: 118 },
  { key: 'tripIncome', label: 'Trip Income', width: 120 },
  { key: 'shortage', label: 'Shortage', width: 104 },
  { key: 'tds', label: 'TDS', width: 100 },
  { key: 'diesel', label: 'Diesel', width: 104 },
  { key: 'amount', label: 'Amount', width: 112 },
];
const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
const totalNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const formatTotal = (value) => (Number.isFinite(value) ? totalNumber.format(value) : 'NA');
const numericColumns = ['tripIncome', 'shortage', 'tds', 'diesel', 'amount'];
const totalLabels = { tripIncome: 'Trip Income', shortage: 'Shortage', tds: 'TDS', diesel: 'Diesel', amount: 'Amount' };
const cellStyle = {
  paddingHorizontal: 6,
  paddingVertical: 8,
  borderWidth: 0.5,
  borderColor: '#aebfc8',
  justifyContent: 'center',
};
const totalLabelWidth = columns.slice(0, 7).reduce((sum, column) => sum + column.width, 0);

function MonthlyIncomeTable({ state }) {
  const routeCorporation = state.corporation || state.state;
  const routeNote = state.corporations?.length ? ` (${state.corporations.join(', ')} routes)` : '';
  const valueFor = (row, key) => {
    if (['loadingDate', 'unloadingDate'].includes(key)) return row[key] ? formatDateLong(row[key]) : '-';
    if (key === 'loadingWeightTons') {
      return Number.isFinite(row[key])
        ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(row[key])} t`
        : '-';
    }
    if (numericColumns.includes(key)) return formatMoney(row[key]);
    return row[key] ?? '-';
  };

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ marginBottom: 6, color: '#183b4b', fontSize: 13, fontWeight: '700' }}>
        {state.state}{routeNote}
        <Text style={{ color: '#4b5f52', fontSize: 12, fontWeight: '400' }}>
          {' '}- {state.totals.trips} unloading{state.totals.trips === 1 ? '' : 's'}
        </Text>
      </Text>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
        <View style={{ width: totalWidth, borderWidth: 1, borderColor: '#9aadb8' }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#eaf2f6' }}>
            {columns.map((column) => (
              <View key={column.key} style={[cellStyle, { width: column.width, minHeight: 48 }]}>
                <Text style={{ color: '#183b4b', fontSize: 11, fontWeight: '700' }}>{column.label}</Text>
              </View>
            ))}
          </View>
          {state.rows.map((row, index) => (
            <View key={`${row.tripId}-${row.leg || index}`} style={{ flexDirection: 'row', backgroundColor: index % 2 ? '#f7fafc' : '#fff' }}>
              {columns.map((column) => (
                <View key={column.key} style={[cellStyle, { width: column.width, minHeight: 44 }]}>
                  <Text style={{
                    color: '#152936',
                    fontSize: 11,
                    textAlign: numericColumns.includes(column.key) ? 'right' : 'left',
                  }}>
                    {valueFor(row, column.key)}
                  </Text>
                  {column.key === 'vehicleNumber' && row.status !== 'closed' ? (
                    <Text style={{ color: '#4b5f52', fontSize: 10 }}>
                      {row.status === 'open' ? 'Open' : 'Closing'}
                    </Text>
                  ) : null}
                  {column.key === 'unloadingLocation' && row.leg === 'divert' ? (
                    <Text style={{ color: '#4b5f52', fontSize: 10 }}>Divert (new unloading)</Text>
                  ) : null}
                  {column.key === 'tripIncome' && row.tripIncome == null && row.notes?.length ? (
                    <Text style={{ color: '#8a5a00', fontSize: 10 }}>{row.notes[0]}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
          <View style={{ flexDirection: 'row', backgroundColor: '#eaf2f6' }}>
            <View style={[cellStyle, { width: totalLabelWidth }]}>
              <Text style={{ color: '#183b4b', fontWeight: '700' }}>
                ₹Total {routeCorporation}
                {state.totals.pricedTrips < state.totals.trips
                  ? ` (${state.totals.trips - state.totals.pricedTrips} unpriced)`
                  : ''}
              </Text>
            </View>
            {numericColumns.map((key) => {
              const column = columns.find((entry) => entry.key === key);
              return (
                <View key={key} style={[cellStyle, { width: column.width, minHeight: 44 }]}>
                  <Text style={{ color: '#183b4b', textAlign: 'right', fontWeight: '700', fontSize: 11 }}>
                    {formatTotal(state.totals[key])}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function TotalsTable({ label, totals }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ width: totalWidth, marginTop: spacing.sm, flexDirection: 'row', backgroundColor: '#eaf2f6' }}>
        <View style={[cellStyle, { width: totalLabelWidth }]}>
          <Text style={{ color: '#183b4b', fontWeight: '700' }}>{label}</Text>
        </View>
        {numericColumns.map((key) => {
          const column = columns.find((entry) => entry.key === key);
          return (
            <View key={key} style={[cellStyle, { width: column.width }]}>
              <Text style={{ color: '#183b4b', textAlign: 'right', fontWeight: '700', fontSize: 11 }}>
                {`${totalLabels[key]} ${formatTotal(totals[key])}`}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function MonthlyIncomeTables({ income, month }) {
  return (
    <View>
      {income.groups.map((group) => (
        <View key={group.vehicleCorporation} style={{ marginTop: spacing.lg }}>
          <Text style={{ paddingBottom: 5, borderBottomWidth: 1, borderColor: '#176f50', color: '#183b4b', fontSize: 15, fontWeight: '700' }}>
            {group.vehicleCorporation}
            <Text style={{ color: '#4b5f52', fontSize: 12, fontWeight: '400' }}>
              {' '}- {group.totals.trips} unloading{group.totals.trips === 1 ? '' : 's'}
              {' '}- {group.halfMonth ? 'billed per half month' : 'billed once a month'}
              {' '}- {group.cutoffDay > 0 ? `cut-off: up to the ${group.cutoffDay}th of next month` : 'cut-off: calendar month'}
            </Text>
          </Text>
          {group.periods.map((period) => (
            <View key={period.key} style={{ marginTop: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#c9d8cc', backgroundColor: '#fbfdfb' }}>
              <Text style={{ color: '#183b4b', fontSize: 14, fontWeight: '700' }}>
                {group.vehicleCorporation} - {period.label} {formatMonthLabel(month)}
                <Text style={{ color: '#4b5f52', fontSize: 12, fontWeight: '400' }}>
                  {' '}- {period.totals.trips} unloading{period.totals.trips === 1 ? '' : 's'}
                </Text>
              </Text>
              {period.states.length === 0 ? (
                <Muted style={{ marginTop: spacing.sm }}>No unloadings in this period.</Muted>
              ) : null}
              {period.states.map((state) => (
                <MonthlyIncomeTable key={state.corporation || state.state} state={state} />
              ))}
              {period.states.length > 1 ? (
                <TotalsTable label={`Total ${group.vehicleCorporation} - ${period.label}`} totals={period.totals} />
              ) : null}
            </View>
          ))}
          {group.periods.length > 1 ? (
            <TotalsTable label={`Total ${group.vehicleCorporation}`} totals={group.totals} />
          ) : null}
        </View>
      ))}
      {income.groups.length > 1 ? (
        <TotalsTable label="Total - all corporations" totals={income.totals} />
      ) : null}
    </View>
  );
}

export default function MonthlyIncomeCard({ customerId }) {
  const months = useMemo(() => selectableMonths(), []);
  const [month, setMonth] = useState(currentMonth());
  const [income, setIncome] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [showTable, setShowTable] = useState(false);
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

  async function shareMonthlyIncomePdf() {
    setSharingPdf(true);
    setError('');
    try {
      const html = buildMonthlyIncomeHtml(income, month);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate monthly income PDF'));
    } finally {
      setSharingPdf(false);
    }
  }

  return (
    <Card title={`Monthly Income (${formatMonthLabel(month)})`}>
      <Select
        label="Income Month"
        value={month}
        options={months.map((key) => ({ value: key, label: formatMonthLabel(key) }))}
        onChange={(value) => { if (value) { setMonth(value); setShowTable(false); } }}
        placeholder="Select month"
        dropdown
      />
      <Button
        title="Print / Save PDF"
        variant="secondary"
        onPress={shareMonthlyIncomePdf}
        loading={sharingPdf}
        disabled={loading || !income?.groups?.length}
        style={{ alignSelf: 'flex-end', marginBottom: spacing.md }}
      />
      <Muted style={{ marginBottom: spacing.md }}>
        Income is grouped by vehicle corporation, billing period and route corporation; corporation cut-off rules apply.
      </Muted>
      <ErrorText>{error}</ErrorText>
      {loading ? <Loading text="Loading monthly income..." /> : null}
      {!loading && income?.groups?.length === 0 ? <Muted>No unloadings in {formatMonthLabel(month)}.</Muted> : null}
      {!loading && income?.groups?.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showTable }}
          onPress={() => setShowTable((current) => !current)}
          style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderColor: '#d5e0e7' }}
        >
          <Text style={{ color: '#176f50', fontSize: 15, fontWeight: '700' }}>
            {showTable ? '\u25B2 Hide monthly income table' : '\u25BC View monthly income table'}
          </Text>
        </Pressable>
      )}
      {!loading && showTable && income?.groups?.length > 0 ? <MonthlyIncomeTables income={income} month={month} /> : null}
    </Card>
  );
}
