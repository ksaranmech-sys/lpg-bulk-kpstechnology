import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { VEHICLE_EXPENSE_CATEGORIES, currentMonth, formatDate, formatMonthLabel, monthKey, toDateInputValue } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { confirm } from '../../confirm';
import { Button, Card, DateField, Field, Input, Loading, Muted, NumberInput, Row, Select } from '../../ui';
import { ButtonRow, EditBox, EntryRow, LocationPicker } from '../../trip/common';
import { spacing } from '../../theme';
import { expenseVehicleId, formatRs } from './VehicleExpensesCard';

const EMPTY_FORM = { category: '', amount: '', date: '', note: '' };

function ExpenseFields({ form, setForm }) {
  return (
    <>
      <LocationPicker
        label="Expense Type"
        value={form.category}
        onChange={(category) => setForm({ ...form, category })}
        options={VEHICLE_EXPENSE_CATEGORIES}
        placeholder="Select or enter expense type"
      />
      <Field label="Amount (Rs)">
        <NumberInput value={form.amount} onChangeText={(amount) => setForm({ ...form, amount })} />
      </Field>
      <DateField label="Date" value={form.date} onChange={(date) => setForm({ ...form, date })} />
      <Field label="Note (optional)">
        <Input value={form.note} onChangeText={(note) => setForm({ ...form, note })} />
      </Field>
    </>
  );
}

const canSubmit = (form) => Boolean(form.category.trim() && form.amount !== '' && form.date);

// Port of the web DriverVehicleExpenses: add / edit / delete running costs for this driver's vehicle.
export default function DriverVehicleExpenses({ customerId, vehicle, setError }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveMonth, setArchiveMonth] = useState('');

  useEffect(() => {
    let active = true;
    if (!customerId || !vehicle?._id) return undefined;
    setLoading(true);
    api.listVehicleExpenses({ customerId })
      .then((res) => {
        if (!active) return;
        setExpenses((res.data.expenses || []).filter((expense) => expenseVehicleId(expense) === String(vehicle._id)));
      })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load vehicle expenses')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId, vehicle?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const thisMonth = currentMonth();
  // Current month stays on the main list; everything older is archived by month.
  const currentEntries = expenses.filter((expense) => monthKey(expense.date) === thisMonth);
  const archivedEntries = expenses.filter((expense) => monthKey(expense.date) !== thisMonth);
  const archivedMonths = useMemo(() => (
    Array.from(new Set(archivedEntries.map((expense) => monthKey(expense.date)).filter(Boolean))).sort().reverse()
  ), [archivedEntries]);
  const archiveKey = archiveMonth || archivedMonths[0] || '';
  const visibleEntries = showArchived ? archivedEntries.filter((expense) => monthKey(expense.date) === archiveKey) : currentEntries;
  const visibleTotal = visibleEntries.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const year = (showArchived && archiveKey ? archiveKey : thisMonth).slice(0, 4);
  const yearTotal = expenses
    .filter((expense) => monthKey(expense.date).slice(0, 4) === year)
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

  async function addExpense() {
    setError('');
    setSaving(true);
    try {
      const res = await api.createVehicleExpense({ ...form, vehicleId: vehicle._id, amount: Number(form.amount) });
      setExpenses((current) => [res.data.expense, ...current]);
      setForm(EMPTY_FORM);
      setShowAddForm(false);
    } catch (err) {
      setError(errorMessage(err, 'Failed to add vehicle expense'));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(expense) {
    setEditId(expense._id);
    setEditForm({
      category: expense.category || '',
      amount: String(expense.amount ?? ''),
      date: toDateInputValue(expense.date) || '',
      note: expense.note || '',
    });
    setError('');
  }

  function cancelEdit() {
    setEditId('');
    setEditForm(EMPTY_FORM);
  }

  async function saveEdit() {
    if (!editId) return;
    setError('');
    setEditSaving(true);
    try {
      const res = await api.updateVehicleExpense(editId, { ...editForm, amount: Number(editForm.amount) });
      setExpenses((current) => current.map((expense) => (expense._id === editId ? res.data.expense : expense)));
      cancelEdit();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update vehicle expense'));
    } finally {
      setEditSaving(false);
    }
  }

  async function removeExpense(expenseId) {
    if (!(await confirm('Delete this vehicle expense?'))) return;
    setError('');
    try {
      await api.deleteVehicleExpense(expenseId);
      setExpenses((current) => current.filter((expense) => expense._id !== expenseId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete vehicle expense'));
    }
  }

  return (
    <Card title={`Vehicle Expenses ${vehicle.vehicleNumber}`}>
      <Muted style={{ fontWeight: '700', marginBottom: spacing.sm }}>{formatMonthLabel(showArchived && archiveKey ? archiveKey : thisMonth)}</Muted>
      {loading ? <Loading text="Loading vehicle expenses..." /> : visibleEntries.length === 0 ? (
        <Muted>{showArchived ? 'No archived vehicle expenses.' : 'No vehicle expenses this month.'}</Muted>
      ) : visibleEntries.map((expense) => (
        editId === expense._id ? (
          <EditBox key={expense._id}>
            <ExpenseFields form={editForm} setForm={setEditForm} />
            <ButtonRow>
              <Button title="Save" onPress={saveEdit} loading={editSaving} disabled={!canSubmit(editForm)} style={{ flex: 1 }} />
              <Button title="Cancel" variant="secondary" onPress={cancelEdit} style={{ flex: 1 }} />
            </ButtonRow>
          </EditBox>
        ) : (
          <EntryRow
            key={expense._id}
            title={`${expense.category} - ${formatRs(expense.amount)}`}
            subtitle={`${formatDate(expense.date)}${expense.note ? `\n${expense.note}` : ''}`}
          >
            <Button title="Edit" variant="secondary" onPress={() => startEdit(expense)} style={{ minHeight: 36, paddingVertical: 6 }} />
            <Button title="Delete" variant="danger" onPress={() => removeExpense(expense._id)} style={{ minHeight: 36, paddingVertical: 6 }} />
          </EntryRow>
        )
      ))}
      <View style={{ marginTop: spacing.sm }}>
        <Row label="Month Total" value={formatRs(visibleTotal)} bold />
        <Row label={`Yearly Total ${year}`} value={formatRs(yearTotal)} bold />
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <Button title={showAddForm ? 'Close Add' : 'Add'} onPress={() => setShowAddForm((current) => !current)} />
        {showAddForm && (
          <View style={{ marginTop: spacing.lg }}>
            <Muted style={{ fontWeight: '700', marginBottom: spacing.sm }}>Add Vehicle Expense</Muted>
            <ExpenseFields form={form} setForm={setForm} />
            <Button title="Add Expense" onPress={addExpense} loading={saving} disabled={!canSubmit(form)} />
          </View>
        )}
      </View>
      {archivedEntries.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <Button
            title={showArchived ? 'Back to current month' : `View archived expenses (${archivedEntries.length})`}
            variant="secondary"
            onPress={() => { setShowArchived((current) => !current); cancelEdit(); }}
          />
          {showArchived && (
            <Select
              label="Archived Month"
              value={archiveKey}
              options={archivedMonths.map((key) => ({ value: key, label: formatMonthLabel(key) }))}
              onChange={(next) => { if (next) setArchiveMonth(next); }}
            />
          )}
        </View>
      )}
    </Card>
  );
}
