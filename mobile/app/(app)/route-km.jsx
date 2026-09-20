import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../src/AuthContext';
import { api, errorMessage } from '../../src/api';
import { Button, Card, ErrorText, Loading, Muted, Screen } from '../../src/ui';
import { spacing } from '../../src/theme';
import RouteFields, { isRouteComplete } from '../../src/features/routeKm/RouteFields';
import RouteKmRow from '../../src/features/routeKm/RouteKmRow';

const EMPTY_FORM = { loadingLocation: '', corporation: '', unloadingLocation: '', km: '' };
const rowIdOf = (row) => row.id || `${row.loadingLocation}-${row.unloadingLocation}`;

// Port of the web RouteKmTable (super_admin only). Add/edit/delete change the local table;
// "Save changes" PUTs the whole table, exactly like the web.
export default function RouteKmScreen() {
  const { user } = useAuth();
  const [routeKmTable, setRouteKmTable] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isSuper = user?.role === ROLES.SUPER_ADMIN;

  useFocusEffect(useCallback(() => {
    if (!isSuper) return undefined;
    let active = true;
    api.getMeta()
      .then((res) => {
        if (!active) return;
        setRouteKmTable(res.data.routeKmTable || []);
        setHasChanges(false);
      })
      .catch(() => {
        if (!active) return;
        setRouteKmTable([]);
        setHasChanges(false);
      });
    return () => { active = false; };
  }, [isSuper]));

  if (!isSuper) {
    return <Screen><Card><Muted>You do not have access to this page.</Muted></Card></Screen>;
  }
  if (!routeKmTable) return <Loading text="Loading KM table..." />;

  async function saveRouteKmTable() {
    setError('');
    setSaving(true);
    try {
      const nextTable = routeKmTable
        .filter((row) => row.loadingLocation || row.unloadingLocation || row.corporation || row.km !== '')
        .map((row) => ({
          ...row,
          loadingLocation: String(row.loadingLocation || '').trim(),
          corporation: String(row.corporation || '').trim(),
          unloadingLocation: String(row.unloadingLocation || '').trim(),
          km: Number(row.km),
        }));
      const res = await api.updateRouteKmTable(nextTable);
      setRouteKmTable(res.data.routeKmTable || []);
      setHasChanges(false);
    } catch (err) {
      setError(errorMessage(err, 'Failed to save route table'));
    } finally {
      setSaving(false);
    }
  }

  function addRouteKmRow() {
    if (!isRouteComplete(form)) return;
    setRouteKmTable((current) => [
      ...current,
      {
        id: `row-${Date.now()}`,
        loadingLocation: form.loadingLocation.trim(),
        corporation: form.corporation.trim(),
        unloadingLocation: form.unloadingLocation.trim(),
        km: Number(form.km),
      },
    ]);
    setForm(EMPTY_FORM);
    setHasChanges(true);
  }

  function updateRouteKmRow(rowId, changes) {
    setRouteKmTable((current) => current.map((row) => (rowIdOf(row) === rowId ? { ...row, ...changes } : row)));
    setHasChanges(true);
  }

  function deleteRouteKmRow(rowId) {
    setRouteKmTable((current) => current.filter((row) => rowIdOf(row) !== rowId));
    setHasChanges(true);
  }

  return (
    <Screen>
      <Card title="Add route">
        <RouteFields value={form} onChange={setForm} />
        <Button title="Add route" variant="secondary" onPress={addRouteKmRow} disabled={!isRouteComplete(form)} />
      </Card>

      <Card
        title={`KM Table (${routeKmTable.length})`}
        right={hasChanges ? <Muted>Unsaved changes</Muted> : null}
      >
        {routeKmTable.length === 0 ? <Muted>No routes yet. Add one above.</Muted> : null}
        {routeKmTable.map((row) => {
          const rowId = rowIdOf(row);
          return (
            <RouteKmRow
              key={rowId}
              row={row}
              onChange={(changes) => updateRouteKmRow(rowId, changes)}
              onDelete={() => deleteRouteKmRow(rowId)}
            />
          );
        })}
        <ErrorText>{error}</ErrorText>
        <View style={{ marginTop: spacing.lg }}>
          <Button title="Save changes" onPress={saveRouteKmTable} loading={saving} disabled={!hasChanges} />
        </View>
      </Card>
    </Screen>
  );
}
