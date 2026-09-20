import React from 'react';
import { formatDate } from '@kps/shared';
import { Button, DateField, Field, Input, Muted, Select } from '../../ui';
import { ButtonRow, EditBox, EntryRow } from '../../trip/common';
import { spacing } from '../../theme';

export function leaveDriverId(leave) {
  return String(leave.driver?._id || leave.driver?.id || leave.driver || '');
}

// Start/end/reason fields shared by the add and edit forms. `drivers` adds the admin driver picker.
export function LeaveFields({ form, setForm, drivers }) {
  return (
    <>
      {drivers && (
        <Select
          label="Driver"
          value={form.driverId}
          onChange={(driverId) => setForm({ ...form, driverId })}
          options={drivers.map((driver) => ({ value: String(driver.id || driver._id), label: driver.name || driver.username }))}
          placeholder="No active drivers"
        />
      )}
      <DateField label="Start Date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} />
      <DateField label="End Date" value={form.endDate} min={form.startDate || undefined} onChange={(endDate) => setForm({ ...form, endDate })} />
      <Field label="Reason (optional)">
        <Input value={form.reason} onChangeText={(reason) => setForm({ ...form, reason })} />
      </Field>
    </>
  );
}

// One leave entry: read-only row with Edit/Delete, or the inline edit form when selected.
export function LeaveItem({ leave, showDriver, canEdit, entries }) {
  const { leaveEditId, leaveEditForm, setLeaveEditForm, leaveEditSaving, startEditLeave, cancelEditLeave, saveLeaveEdit, removeLeave } = entries;
  const dateRange = `${formatDate(leave.startDate)} - ${leave.endDate ? formatDate(leave.endDate) : '-'}`;

  if (leaveEditId === leave._id) {
    return (
      <EditBox>
        {showDriver ? <Muted style={{ marginBottom: spacing.sm }}>{leave.driver?.name || leave.driver?.username || 'Unknown driver'}</Muted> : null}
        <LeaveFields form={leaveEditForm} setForm={setLeaveEditForm} />
        <ButtonRow>
          <Button title="Save" onPress={saveLeaveEdit} loading={leaveEditSaving} disabled={!leaveEditForm.startDate || !leaveEditForm.endDate} style={{ flex: 1 }} />
          <Button title="Cancel" variant="secondary" onPress={cancelEditLeave} style={{ flex: 1 }} />
        </ButtonRow>
      </EditBox>
    );
  }

  const title = showDriver ? (leave.driver?.name || leave.driver?.username || 'Unknown driver') : dateRange;
  const subtitle = showDriver ? `${dateRange}\n${leave.reason || 'No reason provided'}` : (leave.reason || 'No reason provided');
  return (
    <EntryRow title={title} subtitle={subtitle}>
      {canEdit && (
        <>
          <Button title="Edit" variant="secondary" onPress={() => startEditLeave(leave)} style={{ minHeight: 36, paddingVertical: 6 }} />
          <Button title="Delete" variant="danger" onPress={() => removeLeave(leave._id)} style={{ minHeight: 36, paddingVertical: 6 }} />
        </>
      )}
    </EntryRow>
  );
}
