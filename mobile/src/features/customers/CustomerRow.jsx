import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../../api';
import { confirm } from '../../confirm';
import { Button, ErrorText, Field, Input, Muted } from '../../ui';
import { colors, spacing } from '../../theme';

// One row of the web CustomerList. The web edits/deletes a checked selection in bulk; on mobile
// each row carries its own Edit / Block / Delete actions and hits the same endpoints per row.
export default function CustomerRow({ customer, onOpen, onChange, onDelete }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const editing = draft !== null;
  const otherBusy = (action) => Boolean(busy) && busy !== action;

  function startEdit() {
    setError('');
    setDraft({
      companyName: customer.companyName || '',
      email: customer.email || '',
      mobileNumber: customer.mobileNumber || '',
    });
  }

  async function saveEdit() {
    setError('');
    setBusy('save');
    try {
      const res = await api.updateCustomer(customer._id, draft);
      onChange(res.data.customer);
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to save customer changes'));
    } finally {
      setBusy('');
    }
  }

  async function toggleStatus() {
    setError('');
    setBusy('status');
    try {
      const res = await api.setCustomerStatus(customer._id, !customer.isActive);
      onChange(res.data.customer);
    } catch (err) {
      setError(errorMessage(err, 'Failed to update customer status'));
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    const ok = await confirm(`Delete ${customer.companyName}? This will also delete their users, vehicles, and trips.`);
    if (!ok) return;
    setError('');
    setBusy('delete');
    try {
      await api.deleteCustomer(customer._id);
      onDelete(customer._id);
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete customer'));
    } finally {
      setBusy('');
    }
  }

  if (editing) {
    const update = (field) => (value) => setDraft((current) => ({ ...current, [field]: value }));
    return (
      <View style={styles.row}>
        <Field label="Company name"><Input value={draft.companyName} onChangeText={update('companyName')} /></Field>
        <Field label="Customer email">
          <Input value={draft.email} onChangeText={update('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Field label="Customer mobile number">
          <Input value={draft.mobileNumber} onChangeText={update('mobileNumber')} keyboardType="phone-pad" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <View style={styles.actions}>
          <Button title="Save changes" onPress={saveEdit} loading={busy === 'save'} style={styles.action} />
          <Button title="Cancel" variant="secondary" onPress={() => setDraft(null)} disabled={busy === 'save'} style={styles.action} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable onPress={onOpen} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{customer.companyName}</Text>
          <Muted>{[customer.email, customer.mobileNumber].filter(Boolean).join(' | ')}</Muted>
        </View>
        <View style={[styles.pill, { backgroundColor: customer.isActive ? colors.green100 : '#fbe9e7' }]}>
          <Text style={[styles.pillText, { color: customer.isActive ? colors.success : colors.danger }]}>
            {customer.isActive ? 'Active' : 'Blocked'}
          </Text>
        </View>
      </Pressable>
      <ErrorText>{error}</ErrorText>
      <View style={styles.actions}>
        <Button title="Edit" variant="secondary" onPress={startEdit} disabled={Boolean(busy)} style={styles.action} />
        <Button
          title={customer.isActive ? 'Block' : 'Unblock'}
          variant={customer.isActive ? 'danger' : 'primary'}
          onPress={toggleStatus}
          loading={busy === 'status'}
          disabled={otherBusy('status')}
          style={styles.action}
        />
        <Button title="Delete" variant="danger" onPress={remove} loading={busy === 'delete'} disabled={otherBusy('delete')} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 15, fontWeight: '700', color: colors.green900, marginBottom: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1, paddingHorizontal: 8 },
});
