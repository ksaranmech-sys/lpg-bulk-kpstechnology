import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Field, Input, Select } from '../ui';
import { colors, spacing } from '../theme';

export const trimText = (value) => String(value || '').trim();

// Promise wrapper so sections can `if (!(await confirm(...))) return;` like window.confirm on web.
export function confirm(message, okText = 'Delete') {
  return new Promise((resolve) => {
    Alert.alert('Confirm', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

// Web uses ComboBoxInput; drivers here can tap a suggestion chip or type a free-text value.
export function LocationPicker({ label, value, onChange, options = [], placeholder }) {
  return (
    <>
      <Field label={label}>
        <Input value={value} onChangeText={onChange} placeholder={placeholder} autoCapitalize="words" />
      </Field>
      {options.length > 0 && (
        <Select value={value} options={options} onChange={(next) => { if (next) onChange(next); }} />
      )}
    </>
  );
}

// Saved-value pills, the mobile equivalent of the web summary <span> chips.
export function SummaryChips({ items }) {
  return (
    <View style={styles.chips}>
      {items.filter(Boolean).map((item, index) => (
        <View key={index} style={styles.chip}>
          {item.label ? <Text style={styles.chipLabel}>{item.label} </Text> : null}
          <Text style={[styles.chipValue, item.muted && { color: colors.muted, fontWeight: '400' }]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function EntryRow({ title, subtitle, children }) {
  return (
    <View style={styles.entryRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTitle}>{title}</Text>
        {subtitle ? <Text style={styles.entrySubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function ButtonRow({ children, style }) {
  return <View style={[styles.actions, style]}>{children}</View>;
}

export function EditBox({ children }) {
  return <View style={styles.editBox}>{children}</View>;
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipLabel: { color: colors.muted, fontSize: 14 },
  chipValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  entryTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  entrySubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  editBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.green900, marginBottom: spacing.md },
});
