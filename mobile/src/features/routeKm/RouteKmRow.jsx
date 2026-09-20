import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Muted } from '../../ui';
import { colors, spacing } from '../../theme';
import RouteFields, { isRouteComplete } from './RouteFields';

// One KM table row. Edit opens an inline form; Done/Delete only change the local table and the
// parent persists everything with "Save changes", matching the web's batched save.
export default function RouteKmRow({ row, onChange, onDelete }) {
  const [draft, setDraft] = useState(null);

  function startEdit() {
    setDraft({
      loadingLocation: row.loadingLocation || '',
      unloadingLocation: row.unloadingLocation || '',
      corporation: row.corporation || '',
      km: row.km === undefined || row.km === null ? '' : String(row.km),
    });
  }

  function apply() {
    onChange({
      loadingLocation: draft.loadingLocation,
      unloadingLocation: draft.unloadingLocation,
      corporation: draft.corporation,
      km: Number(draft.km),
    });
    setDraft(null);
  }

  if (draft) {
    return (
      <View style={styles.row}>
        <RouteFields value={draft} onChange={setDraft} />
        <View style={styles.actions}>
          <Button title="Done" onPress={apply} disabled={!isRouteComplete(draft)} style={styles.action} />
          <Button title="Cancel" variant="secondary" onPress={() => setDraft(null)} style={styles.action} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{row.loadingLocation} {'\u2192'} {row.unloadingLocation}</Text>
          <Muted>{row.corporation || 'No corporation'}</Muted>
        </View>
        <Text style={styles.km}>{row.km} km</Text>
      </View>
      <View style={styles.actions}>
        <Button title="Edit" variant="secondary" onPress={startEdit} style={styles.action} />
        <Button title="Delete" variant="danger" onPress={onDelete} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 15, fontWeight: '700', color: colors.green900, marginBottom: 2 },
  km: { fontSize: 15, fontWeight: '700', color: colors.green700 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1 },
});
