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
  { key: 'sNo', label: 'S.No', width: 68 },
  { key: 'vehicleNumber', label: 'Vehicle Number', width: 136 },
  { key: 'loadingLocation', label: 'Loading Location', width: 166 },
  { key: 'unloadingLocation', label: 'Unloading Location', width: 166 },
  { key: 'unloadingDate', label: 'Unloading Date', width: 132 },
  { key: 'tripIncome', label: 'Trip Income', width: 126 },
  { key: 'shortage', label: 'Shortage', width: 112 },
  { key: 'diesel', label: 'Diesel', width: 112 },
  { key: 'amount', label: 'Amount', width: 118 },
];

function MonthlyIncomeTable({ income }) {
  const rows = (income?.groups || []).flatMap((group) => (
    group.periods.flatMap((period) => period.states.flatMap((state) => state.rows))
  ));
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const totalFor = (key) => {
    const serverTotal = income?.totals?.[key];
    if (Number.isFinite(serverTotal)) return serverTotal;
    const values = rows.map((row) => row[key]).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  const cellStyle = {
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: '#aebfc8',
    justifyContent: 'center',
  };
  const valueFor = (row, key) => {
    if (key === 'unloadingDate') return row.unloadingDate ? formatDateLong(row.unloadingDate) : '-';
    if (['tripIncome', 'shortage', 'diesel', 'amount'].includes(key)) return formatMoney(row[key]);
    return row[key] ?? '-';
  };
  const totalLabelWidth = columns.slice(0, 5).reduce((sum, column) => sum + column.width, 0);

  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
      <View style={{ width: totalWidth, borderWidth: 1, borderColor: '#9aadb8', borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#eaf2f6' }}>
          {columns.map((column) => (
            <View
              key={column.key}
              style={[cellStyle, { width: column.width, height: 84, alignItems: 'center', overflow: 'visible' }]}
            >
              <Text
                numberOfLines={1}
                style={{
                  width: 124,
                  textAlign: 'center',
                  color: '#183b4b',
                  fontSize: 11,
                  fontWeight: '700',
                  transform: [{ rotate: '-45deg' }],
                }}
              >
                {column.label}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((row, index) => (
          <View key={`${row.tripId}-${row.leg || index}`} style={{ flexDirection: 'row', backgroundColor: index % 2 ? '#f7fafc' : '#fff' }}>
            {columns.map((column) => (
              <View key={column.key} style={[cellStyle, { width: column.width, minHeight: 44 }]}>
                <Text style={{
                  color: '#152936',
                  fontSize: 11,
                  textAlign: ['tripIncome', 'shortage', 'diesel', 'amount'].includes(column.key) ? 'right' : 'left',
                }}>
                  {column.key === 'sNo' ? row.sNo : valueFor(row, column.key)}
                </Text>
              </View>
            ))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', backgroundColor: '#eaf2f6' }}>
          <View style={[cellStyle, { width: totalLabelWidth }]}>
            <Text style={{ fontWeight: '700', color: '#183b4b' }}>Total</Text>
          </View>
          {['tripIncome', 'shortage', 'diesel', 'amount'].map((key) => {
            const column = columns.find((entry) => entry.key === key);
            const total = totalFor(key);
            return (
              <View key={key} style={[cellStyle, { width: column.width, minHeight: 44 }]}>
                <Text style={{ textAlign: 'right', fontWeight: '700', color: '#183b4b', fontSize: 11 }}>
                  {total == null ? 'NA' : formatMoney(total)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
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
      {!loading && showTable && income?.groups?.length > 0 ? <MonthlyIncomeTable income={income} /> : null}
    </Card>
  );
}
