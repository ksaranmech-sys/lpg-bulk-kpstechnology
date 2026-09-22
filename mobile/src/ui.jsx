import React, { useState } from 'react';
import {
  ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { toDateInputValue, formatDate } from '@kps/shared';
import { colors, radius, spacing } from './theme';

// Small set of building blocks used by every screen. Kept in one file on purpose so a
// non-specialist can find "what does a button look like" in a single place.

export function Screen({ children, scroll = true, style, scrollRef }) {
  if (!scroll) return <View style={[styles.screen, style]}>{children}</View>;
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ title, children, style, right }) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Field({ label, children, hint }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Input({ style, ...props }) {
  return <TextInput placeholderTextColor="#94a3b8" style={[styles.input, style]} {...props} />;
}

export function NumberInput(props) {
  return <Input keyboardType="decimal-pad" {...props} />;
}

// value/onChange use 'YYYY-MM-DD' strings, matching the web <input type="date"> and the API.
export function DateField({ label, value, onChange, min, max, placeholder = 'Select date' }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return (
    <Field label={label}>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={{ color: value ? colors.ink : '#94a3b8' }}>{value ? formatDate(value) : placeholder}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={min ? new Date(`${min}T00:00:00`) : undefined}
          maximumDate={max ? new Date(`${max}T00:00:00`) : undefined}
          onChange={(event, selected) => {
            setOpen(Platform.OS === 'ios');
            if (event.type === 'set' && selected) onChange(toDateInputValue(selected));
          }}
        />
      )}
      {open && Platform.OS === 'ios' && (
        <Button title="Done" variant="secondary" onPress={() => setOpen(false)} style={{ marginTop: spacing.sm }} />
      )}
    </Field>
  );
}

export function Select({ label, value, options, onChange, placeholder = 'Select...' }) {
  // A simple tap-to-cycle chip list keeps this dependency-free and works well for short lists.
  return (
    <Field label={label}>
      <View style={styles.chips}>
        {options.length === 0 && <Text style={styles.hint}>{placeholder}</Text>}
        {options.map((option) => {
          const opt = typeof option === 'string' ? { value: option, label: option } : option;
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(active ? '' : opt.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

export function Toggle({ label, value, onChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={Boolean(value)} onValueChange={onChange} trackColor={{ true: colors.green500 }} />
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, textStyle }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'link' && styles.buttonLink,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'link' ? colors.green700 : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, (variant === 'secondary' || variant === 'link') && styles.buttonTextSecondary, textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Muted({ children, style }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Row({ label, value, bold }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

export function Badge({ status }) {
  const palette = {
    open: { bg: '#e3f4f1', fg: colors.green700 },
    pending_close: { bg: '#fff4bf', fg: colors.warning },
    closed: { bg: '#e2e8f0', fg: '#334155' },
  }[status] || { bg: '#e2e8f0', fg: '#334155' };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{String(status || '').replace('_', ' ')}</Text>
    </View>
  );
}

export function Loading({ text = 'Loading...' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.green700} />
      <Muted style={{ marginTop: spacing.sm }}>{text}</Muted>
    </View>
  );
}

// Mobile stand-in for <input type="checkbox">; optional label sits to the right.
export function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange && onChange(!checked)}
      disabled={disabled}
      style={[styles.checkboxRow, disabled && { opacity: 0.5 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: Boolean(checked), disabled: Boolean(disabled) }}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkboxTick}>{'\u2713'}</Text> : null}
      </View>
      {label ? <Text style={styles.checkboxLabel}>{label}</Text> : null}
    </Pressable>
  );
}

// Tappable list row with a chevron, used for navigation lists (vehicles, drivers, menu cards).
export function NavRow({ title, subtitle, onPress, right, titleStyle }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.navRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.navTitle, titleStyle]}>{title}</Text>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
      {right !== undefined ? right : (onPress ? <Text style={{ color: colors.muted, fontSize: 18 }}>{'\u203a'}</Text> : null)}
    </Pressable>
  );
}

// Take a photo with the camera (or pick one). onChange receives the picker asset or null.
export function PhotoPicker({ label = 'Photo', asset, onChange }) {
  const [busy, setBusy] = useState(false);

  async function capture(fromCamera) {
    setBusy(true);
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
      // Low quality keeps receipt photos to a few hundred KB instead of several MB.
      const options = { mediaTypes: ['images'], quality: 0.4, allowsEditing: false };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) onChange(result.assets[0]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label}>
      {asset ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Image source={{ uri: asset.uri }} style={styles.thumb} />
          <Button title="Remove" variant="secondary" onPress={() => onChange(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Take photo" variant="secondary" onPress={() => capture(true)} loading={busy} style={{ flex: 1 }} />
          <Button title="Choose" variant="secondary" onPress={() => capture(false)} disabled={busy} style={{ flex: 1 }} />
        </View>
      )}
    </Field>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  screenContent: { padding: spacing.lg, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.green900 },
  field: { marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '700', color: colors.green900, marginBottom: 5, letterSpacing: 0.3 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: '#fbfdfd',
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  chipActive: { backgroundColor: colors.green700, borderColor: colors.green700 },
  chipText: { color: colors.ink, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  button: {
    backgroundColor: colors.green700,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: colors.danger },
  buttonLink: { backgroundColor: 'transparent', minHeight: 32, paddingVertical: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonTextSecondary: { color: colors.green700 },
  error: { color: colors.danger, marginVertical: spacing.sm, fontSize: 13 },
  muted: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { color: colors.ink, flex: 1, paddingRight: spacing.sm },
  rowValue: { color: colors.ink, textAlign: 'right' },
  bold: { fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  loading: { padding: spacing.xl, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#e2e8f0' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.green700,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: colors.green700 },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  checkboxLabel: { color: colors.ink, fontSize: 14 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  navTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 2 },
});
