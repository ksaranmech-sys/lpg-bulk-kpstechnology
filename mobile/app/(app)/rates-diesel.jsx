import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../src/AuthContext';
import { api, errorMessage } from '../../src/api';
import { Button, Card, ErrorText, Loading, Muted, NumberInput, Screen } from '../../src/ui';
import { colors, spacing } from '../../src/theme';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatMonth = (month) => {
  const [year, number] = String(month || '').split('-');
  const name = MONTH_NAMES[Number(number) - 1];
  return name && year ? `${name}-${year.slice(-2)}` : month || '';
};
const cellStyle = {
  width: 82,
  minHeight: 42,
  paddingHorizontal: 4,
  paddingVertical: 6,
  borderRightWidth: 1,
  borderBottomWidth: 1,
  borderColor: colors.border,
  justifyContent: 'center',
  alignItems: 'center',
};
const cellTextStyle = { fontSize: 11, color: colors.ink, textAlign: 'center' };
const inputStyle = { width: 72, minHeight: 36, paddingHorizontal: 4, paddingVertical: 4, textAlign: 'center', fontSize: 12 };

export default function RatesDieselScreen() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const [shortage, setShortage] = useState(null);
  const [shortageDraft, setShortageDraft] = useState('');
  const [shortageEditing, setShortageEditing] = useState(false);
  const [diesel, setDiesel] = useState(null);
  const [dieselDraft, setDieselDraft] = useState({});
  const [dieselEditing, setDieselEditing] = useState(false);
  const [tables, setTables] = useState([]);
  const [rateDrafts, setRateDrafts] = useState({});
  const [rateEditing, setRateEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useFocusEffect(useCallback(() => {
    if (!isSuperAdmin) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.getMeta(),
      api.getDieselPriceTable(),
      api.listRateTables(),
    ])
      .then(([metaRes, dieselRes, rateRes]) => {
        if (!active) return;
        setShortage(Array.isArray(metaRes.data.shortageRates) ? metaRes.data.shortageRates[0] || null : null);
        setDiesel(dieselRes.data.dieselPriceTable || null);
        setTables(rateRes.data.rateTables || []);
        setShortageDraft('');
        setDieselDraft({});
        setRateDrafts({});
        setRateEditing({});
        setDieselEditing(false);
        setShortageEditing(false);
      })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load rates and diesel prices')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isSuperAdmin]));

  if (!isSuperAdmin) {
    return <Screen><Card><Muted>You do not have access to this page.</Muted></Card></Screen>;
  }
  if (loading) return <Loading text="Loading rates and diesel prices..." />;
  const months = diesel?.months || [];

  async function saveShortage() {
    if (!String(shortageDraft).trim()) {
      setError('Enter a shortage rate.');
      return;
    }
    const value = Number(shortageDraft);
    if (!Number.isFinite(value) || value < 0) {
      setError('Shortage Rs/Kg must be a valid non-negative number.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await api.updateShortageRates([{
        id: shortage?.id || `shortage-${Date.now()}`,
        name: shortage?.name || 'Shortage',
        amountPerKg: value,
      }]);
      setShortage(res.data.shortageRates?.[0] || null);
      setShortageDraft('');
      setShortageEditing(false);
    } catch (err) {
      setError(errorMessage(err, 'Failed to save shortage rate'));
    } finally {
      setSaving(false);
    }
  }

  function deleteShortage() {
    Alert.alert('Delete shortage rate?', 'This removes the shortage rate from the system.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          setError('');
          try {
            await api.updateShortageRates([]);
            setShortage(null);
            setShortageDraft('');
            setShortageEditing(false);
          } catch (err) {
            setError(errorMessage(err, 'Failed to delete shortage rate'));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  function dieselCell(state, month) {
    return diesel?.cells?.[state]?.[month] || null;
  }

  function dieselValue(state, month) {
    const pending = dieselDraft[state]?.[month];
    if (pending !== undefined) return pending;
    const value = dieselCell(state, month)?.value;
    return Number.isFinite(value) ? String(value) : '';
  }

  function setDieselCell(state, month, value) {
    setDieselDraft((current) => ({ ...current, [state]: { ...(current[state] || {}), [month]: value } }));
  }

  async function saveDiesel() {
    const cells = {};
    for (const [state, byMonth] of Object.entries(dieselDraft)) {
      for (const [month, raw] of Object.entries(byMonth)) {
        const text = String(raw).trim();
        const current = dieselCell(state, month);
        if (!text) {
          if (current) (cells[state] ||= {})[month] = null;
          continue;
        }
        const value = Number(text);
        if (!Number.isFinite(value) || value < 0) {
          setError(`Enter a valid diesel price for ${state} (${formatMonth(month)}).`);
          return;
        }
        if (value !== current?.value) (cells[state] ||= {})[month] = value;
      }
    }
    if (!Object.keys(cells).length) {
      setDieselEditing(false);
      setDieselDraft({});
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.updateDieselPriceTable(cells);
      setDiesel(res.data.dieselPriceTable || diesel);
      setDieselEditing(false);
      setDieselDraft({});
    } catch (err) {
      setError(errorMessage(err, 'Failed to save diesel prices'));
    } finally {
      setSaving(false);
    }
  }

  async function refreshPrices() {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.syncDieselPriceTable();
      setDiesel(res.data.dieselPriceTable || diesel);
      setNotice('Diesel prices refreshed.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to refresh diesel prices'));
    } finally {
      setRefreshing(false);
    }
  }

  function baseValue(tableId, rowKey, current) {
    const pending = rateDrafts[tableId]?.[rowKey];
    return pending?.base !== undefined ? pending.base : String(current ?? '');
  }

  function rateCellValue(tableId, rowKey, month, current) {
    const pending = rateDrafts[tableId]?.[rowKey]?.months?.[month];
    return pending !== undefined ? pending : Number.isFinite(current?.value) ? String(current.value) : '';
  }

  function updateRateDraft(tableId, rowKey, change) {
    setRateDrafts((current) => ({
      ...current,
      [tableId]: {
        ...(current[tableId] || {}),
        [rowKey]: { ...(current[tableId]?.[rowKey] || {}), ...change },
      },
    }));
  }

  async function saveRateTable(table) {
    const draft = rateDrafts[table.id] || {};
    const bases = {};
    const cells = {};
    for (const [key, entry] of Object.entries(draft)) {
      const row = table.rows.find((item) => item.key === key);
      if (!row) continue;
      if (entry.base !== undefined) {
        if (!String(entry.base).trim()) {
          setError(`Enter a Base value for ${row.label}.`);
          return;
        }
        const value = Number(String(entry.base).trim());
        if (!Number.isFinite(value) || value < 0) {
          setError(`Enter a valid Base value for ${row.label}.`);
          return;
        }
        if (value !== row.base) bases[key] = value;
      }
      for (const [month, raw] of Object.entries(entry.months || {})) {
        const text = String(raw).trim();
        const current = row.values?.[month];
        if (!text) {
          if (current?.overridden) (cells[key] ||= {})[month] = null;
          continue;
        }
        const value = Number(text);
        if (!Number.isFinite(value) || value < 0) {
          setError(`Enter a valid value for ${row.label} (${formatMonth(month)}).`);
          return;
        }
        if (value !== current?.value) (cells[key] ||= {})[month] = value;
      }
    }
    setError('');
    if (!Object.keys(bases).length && !Object.keys(cells).length) {
      setRateEditing((current) => ({ ...current, [table.id]: false }));
      setRateDrafts((current) => ({ ...current, [table.id]: {} }));
      return;
    }
    setSaving(true);
    try {
      let updated = table;
      if (Object.keys(bases).length) {
        const res = await api.updateRateTableBases(table.id, bases);
        updated = res.data.rateTable || updated;
      }
      if (Object.keys(cells).length) {
        const res = await api.updateRateTableCells(table.id, cells);
        updated = res.data.rateTable || updated;
      }
      setTables((current) => current.map((item) => item.id === table.id ? updated : item));
      setRateDrafts((current) => ({ ...current, [table.id]: {} }));
      setRateEditing((current) => ({ ...current, [table.id]: false }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to save rate table'));
    } finally {
      setSaving(false);
    }
  }

  function recalculateRates() {
    Alert.alert(
      'Recalculate all tables?',
      'This clears manually entered monthly values across all Rate/KM/Ton tables. Tender Base values are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recalculate',
          onPress: async () => {
            setSaving(true);
            setError('');
            try {
              const res = await api.recalculateRateTables();
              setTables(res.data.rateTables || []);
              setNotice('All Rate/KM/Ton tables recalculated from diesel prices.');
            } catch (err) {
              setError(errorMessage(err, 'Failed to recalculate rate tables'));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      {notice ? <Muted style={{ color: colors.success, marginBottom: spacing.sm }}>{notice}</Muted> : null}

      <Card title="Shortage Rate">
        {shortageEditing || !shortage ? (
          <>
            <Muted>Shortage (Rs/Kg)</Muted>
            <NumberInput
              value={shortageEditing ? shortageDraft : ''}
              onChangeText={setShortageDraft}
              placeholder={shortage ? String(shortage.amountPerKg) : '0.00'}
              style={{ marginTop: spacing.sm }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md }}>
              {shortageEditing ? <Button title="Cancel" variant="secondary" onPress={() => { setShortageEditing(false); setShortageDraft(''); }} /> : null}
              <Button title="Save" onPress={saveShortage} loading={saving} />
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.ink, fontSize: 18 }}>Rs {Number(shortage.amountPerKg || 0).toFixed(2)}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Edit" variant="secondary" onPress={() => { setShortageDraft(String(shortage.amountPerKg)); setShortageEditing(true); }} />
              <Button title="Delete" variant="danger" onPress={deleteShortage} disabled={saving} />
            </View>
          </View>
        )}
      </Card>

      <Card
        title="Average Diesel Price"
        right={!dieselEditing
          ? <View style={{ flexDirection: 'row', gap: 4 }}>
            <Button title="Refresh" variant="secondary" onPress={refreshPrices} loading={refreshing} />
            <Button title="Edit" onPress={() => { setDieselDraft({}); setDieselEditing(true); }} disabled={!diesel} />
          </View>
          : null}
      >
        <Muted>Average diesel price (Rs/litre). Scroll horizontally to view all months.</Muted>
        {dieselEditing ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Cancel" variant="secondary" onPress={() => { setDieselEditing(false); setDieselDraft({}); }} disabled={saving} />
            <Button title="Save changes" onPress={saveDiesel} loading={saving} />
          </View>
        ) : null}
        {months.length ? (
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={{ marginTop: spacing.sm }}>
            <View>
              <View style={{ flexDirection: 'row', backgroundColor: '#e3edf4' }}>
                <View style={[cellStyle, { width: 116, alignItems: 'flex-start' }]}>
                  <Text style={[cellTextStyle, { fontWeight: '700' }]}>State (city)</Text>
                </View>
                {months.map((month) => (
                  <View key={month} style={cellStyle}>
                    <Text style={[cellTextStyle, { fontWeight: '700' }]}>{formatMonth(month)}</Text>
                  </View>
                ))}
              </View>
            {(diesel.rows || []).map(({ state, city }) => (
              <View key={state} style={{ flexDirection: 'row' }}>
                <View style={[cellStyle, { width: 116, alignItems: 'flex-start' }]}>
                  <Text style={[cellTextStyle, { fontWeight: '600' }]}>{state}{city ? `\n${city}` : ''}</Text>
                </View>
                {months.map((month) => (
                  <View key={`${state}-${month}`} style={cellStyle}>
                    {dieselEditing ? (
                      <NumberInput
                        style={inputStyle}
                        value={dieselValue(state, month)}
                        onChangeText={(value) => setDieselCell(state, month, value)}
                        accessibilityLabel={`${state} ${formatMonth(month)} average diesel price`}
                      />
                    ) : (
                      <Text style={cellTextStyle}>
                        {Number.isFinite(dieselCell(state, month)?.value) ? dieselCell(state, month).value.toFixed(2) : '-'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
            </View>
          </ScrollView>
        ) : <Muted style={{ marginTop: spacing.sm }}>No diesel price data available.</Muted>}
        {diesel?.lastSyncError ? <ErrorText>Last refresh had issues: {diesel.lastSyncError}</ErrorText> : null}
      </Card>

      <View style={{ alignItems: 'flex-end', marginBottom: spacing.sm }}>
        <Button title="Recalculate all tables" variant="secondary" onPress={recalculateRates} loading={saving} />
      </View>
      {tables.map((table) => {
        const rateMonths = table.months || [];
        const editing = Boolean(rateEditing[table.id]);
        return (
          <Card
            key={table.id}
            title={table.title || 'Rate/KM/Ton'}
            right={!editing
              ? <Button title="Edit values" onPress={() => {
                setRateDrafts((current) => ({ ...current, [table.id]: {} }));
                setRateEditing((current) => ({ ...current, [table.id]: true }));
              }} />
              : null}
          >
            <Muted>Scroll horizontally to view all months. Tender Base values and monthly values can be edited.</Muted>
            {editing ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button title="Cancel" variant="secondary" onPress={() => {
                  setRateDrafts((current) => ({ ...current, [table.id]: {} }));
                  setRateEditing((current) => ({ ...current, [table.id]: false }));
                }} disabled={saving} />
                <Button title="Save changes" onPress={() => saveRateTable(table)} loading={saving} />
              </View>
            ) : null}
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={{ marginTop: spacing.sm }}>
              <View>
                <View style={{ flexDirection: 'row', backgroundColor: '#e3edf4' }}>
                  <View style={[cellStyle, { width: 116, alignItems: 'flex-start' }]}>
                    <Text style={[cellTextStyle, { fontWeight: '700' }]}>KM / row</Text>
                  </View>
                  <View style={[cellStyle, { width: 90 }]}>
                    <Text style={[cellTextStyle, { fontWeight: '700' }]}>Tender Base</Text>
                  </View>
                  {rateMonths.map((month) => (
                    <View key={month} style={cellStyle}>
                      <Text style={[cellTextStyle, { fontWeight: '700' }]}>{formatMonth(month)}</Text>
                    </View>
                  ))}
                </View>
              {table.rows.map((row) => {
                const isPriceRow = row.kind === 'price';
                return (
                  <View key={row.key} style={{ flexDirection: 'row' }}>
                    <View style={[cellStyle, { width: 116, alignItems: 'flex-start' }]}>
                      <Text style={[cellTextStyle, { fontWeight: '600' }]}>{row.label}</Text>
                    </View>
                    <View style={[cellStyle, { width: 90 }]}>
                      {editing && !isPriceRow ? (
                        <NumberInput
                          style={[inputStyle, { width: 80 }]}
                          value={baseValue(table.id, row.key, row.base)}
                          onChangeText={(value) => updateRateDraft(table.id, row.key, { base: value })}
                          accessibilityLabel={`${row.label} tender base`}
                        />
                      ) : (
                        <Text style={cellTextStyle}>{Number.isFinite(row.base) ? row.base.toFixed(row.decimals || 2) : '-'}</Text>
                      )}
                    </View>
                    {rateMonths.map((month) => {
                      const current = row.values?.[month];
                      const value = current?.value;
                      return (
                        <View key={`${row.key}-${month}`} style={cellStyle}>
                          {editing && !isPriceRow ? (
                            <NumberInput
                              style={inputStyle}
                              value={rateCellValue(table.id, row.key, month, current)}
                              onChangeText={(next) => updateRateDraft(table.id, row.key, {
                                months: { ...(rateDrafts[table.id]?.[row.key]?.months || {}), [month]: next },
                              })}
                              accessibilityLabel={`${row.label} ${formatMonth(month)}`}
                            />
                          ) : (
                            <Text style={cellTextStyle}>{Number.isFinite(value) ? value.toFixed(row.decimals || 2) : '-'}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              </View>
            </ScrollView>
            {table.params?.baseDieselMonth && !Number.isFinite(table.params?.baseDieselPrice) ? (
              <ErrorText>Price Escalation needs the {table.dieselState || 'state'} diesel price for {formatMonth(table.params.baseDieselMonth)}. Add it in Average Diesel Price.</ErrorText>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
