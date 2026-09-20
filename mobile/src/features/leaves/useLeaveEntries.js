import { useState } from 'react';
import { isCurrentOrPreviousMonth, monthKey as toMonthKey, toDateInputValue } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { confirm } from '../../confirm';

export const EMPTY_LEAVE_FORM = { driverId: '', startDate: '', endDate: '', reason: '' };

export function isLeaveInCurrentOrPreviousMonth(leave) {
  const key = toMonthKey(leave.startDate);
  return Boolean(key) && isCurrentOrPreviousMonth(key);
}

// Port of the web useLeaveEntries hook (same payloads: createLeave(form), updateLeave(id, form)).
export function useLeaveEntries({ leaves, setLeaves, setLeaveError }) {
  const [leaveForm, setLeaveForm] = useState(EMPTY_LEAVE_FORM);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveEditId, setLeaveEditId] = useState('');
  const [leaveEditForm, setLeaveEditForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [leaveEditSaving, setLeaveEditSaving] = useState(false);
  const [showArchivedLeaves, setShowArchivedLeaves] = useState(false);
  const [showAddLeaveForm, setShowAddLeaveForm] = useState(false);

  async function addLeave() {
    setLeaveError('');
    setLeaveSaving(true);
    try {
      const res = await api.createLeave(leaveForm);
      setLeaves((current) => [res.data.leave, ...current]);
      setLeaveForm(EMPTY_LEAVE_FORM);
      setShowAddLeaveForm(false);
    } catch (err) {
      setLeaveError(errorMessage(err, 'Failed to add leave entry'));
    } finally {
      setLeaveSaving(false);
    }
  }

  async function removeLeave(leaveId) {
    if (!(await confirm('Delete this leave entry?'))) return;
    setLeaveError('');
    try {
      await api.deleteLeave(leaveId);
      setLeaves((current) => current.filter((leave) => leave._id !== leaveId));
    } catch (err) {
      setLeaveError(errorMessage(err, 'Failed to delete leave entry'));
    }
  }

  function startEditLeave(leave) {
    setLeaveEditId(leave._id);
    setLeaveEditForm({
      startDate: toDateInputValue(leave.startDate) || '',
      endDate: leave.endDate ? toDateInputValue(leave.endDate) : '',
      reason: leave.reason || '',
    });
    setLeaveError('');
  }

  function cancelEditLeave() {
    setLeaveEditId('');
    setLeaveEditForm({ startDate: '', endDate: '', reason: '' });
  }

  async function saveLeaveEdit() {
    if (!leaveEditId) return;
    setLeaveError('');
    setLeaveEditSaving(true);
    try {
      const res = await api.updateLeave(leaveEditId, leaveEditForm);
      setLeaves((current) => current.map((leave) => (leave._id === leaveEditId ? res.data.leave : leave)));
      cancelEditLeave();
    } catch (err) {
      setLeaveError(errorMessage(err, 'Failed to update leave entry'));
    } finally {
      setLeaveEditSaving(false);
    }
  }

  const archivedLeaves = leaves.filter((leave) => !isLeaveInCurrentOrPreviousMonth(leave));
  const visibleLeaves = showArchivedLeaves ? leaves : leaves.filter(isLeaveInCurrentOrPreviousMonth);

  return {
    leaveForm, setLeaveForm, leaveSaving,
    leaveEditId, leaveEditForm, setLeaveEditForm, leaveEditSaving,
    showArchivedLeaves, setShowArchivedLeaves,
    showAddLeaveForm, setShowAddLeaveForm,
    addLeave, removeLeave, startEditLeave, cancelEditLeave, saveLeaveEdit,
    archivedLeaves, visibleLeaves,
  };
}
