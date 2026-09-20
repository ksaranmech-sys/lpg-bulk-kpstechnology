import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ErrorText, Loading, Muted, Select } from '../../ui';
import { spacing } from '../../theme';
import { useLeaveEntries } from './useLeaveEntries';
import { LeaveFields, LeaveItem, leaveDriverId } from './LeaveItem';

// Port of DriverLeaveSection (isDriver) and AdminLeaveSection (drivers given).
// Admins get driver chips that filter the list and pre-fill the "Apply Leave" form.
export default function LeavesCard({ leaves, setLeaves, leavesLoading, leaveError, setLeaveError, drivers, isDriver }) {
  const entries = useLeaveEntries({ leaves, setLeaves, setLeaveError });
  const {
    leaveForm, setLeaveForm, leaveSaving, showArchivedLeaves, setShowArchivedLeaves,
    showAddLeaveForm, setShowAddLeaveForm, addLeave, archivedLeaves, visibleLeaves,
  } = entries;
  const [filterDriverId, setFilterDriverId] = useState('');

  const shownLeaves = filterDriverId ? visibleLeaves.filter((leave) => leaveDriverId(leave) === filterDriverId) : visibleLeaves;
  const canSubmit = Boolean(leaveForm.startDate && leaveForm.endDate && (isDriver || leaveForm.driverId));

  function toggleAddForm() {
    if (!showAddLeaveForm && filterDriverId) setLeaveForm({ ...leaveForm, driverId: filterDriverId });
    setShowAddLeaveForm((current) => !current);
  }

  return (
    <Card title="Leave Entries">
      <ErrorText>{leaveError}</ErrorText>
      {!isDriver && (
        <Select
          label="Driver"
          value={filterDriverId}
          onChange={setFilterDriverId}
          options={(drivers || []).map((driver) => ({ value: String(driver.id || driver._id), label: driver.name || driver.username }))}
          placeholder="No active drivers"
        />
      )}
      {leavesLoading ? <Loading text="Loading leave entries..." /> : shownLeaves.length === 0 ? (
        <Muted style={{ marginBottom: spacing.md }}>No leave entries found.</Muted>
      ) : (
        <View>
          {shownLeaves.map((leave) => (
            <LeaveItem key={leave._id} leave={leave} showDriver={!isDriver} canEdit entries={entries} />
          ))}
        </View>
      )}
      {archivedLeaves.length > 0 && (
        <Button
          title={showArchivedLeaves ? 'Hide archived leaves' : `View archived leaves (${archivedLeaves.length})`}
          variant="secondary"
          onPress={() => setShowArchivedLeaves((current) => !current)}
          style={{ marginTop: spacing.md }}
        />
      )}

      {isDriver ? (
        <View style={{ marginTop: spacing.lg }}>
          <LeaveFields form={leaveForm} setForm={setLeaveForm} />
          <Button title="Add Leave" onPress={addLeave} loading={leaveSaving} disabled={!canSubmit} />
        </View>
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          <Button title={showAddLeaveForm ? 'Close Add' : 'Add'} onPress={toggleAddForm} />
          {showAddLeaveForm && (
            <View style={{ marginTop: spacing.lg }}>
              <Muted style={{ fontWeight: '700', marginBottom: spacing.sm }}>Apply Leave</Muted>
              <LeaveFields form={leaveForm} setForm={setLeaveForm} drivers={drivers || []} />
              <Button title="Apply Leave" onPress={addLeave} loading={leaveSaving} disabled={!canSubmit} />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}
