import { useState } from 'react';
import { isCurrentOrPreviousMonth, monthKey as toMonthKey } from '@kps/shared';
import * as api from '../../api/api';

function isLeaveInCurrentOrPreviousMonth(leave) {
  const key = toMonthKey(leave.startDate);
  return Boolean(key) && isCurrentOrPreviousMonth(key);
}

export function useLeaveEntries({ leaves, setLeaves, setLeaveError }) {
  const [leaveForm, setLeaveForm] = useState({ driverId: '', startDate: '', endDate: '', reason: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveEditId, setLeaveEditId] = useState('');
  const [leaveEditForm, setLeaveEditForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [leaveEditSaving, setLeaveEditSaving] = useState(false);
  const [showArchivedLeaves, setShowArchivedLeaves] = useState(false);
  const [selectedLeaves, setSelectedLeaves] = useState([]);
  const [showAddLeaveForm, setShowAddLeaveForm] = useState(false);

  async function addLeave(event) {
    event.preventDefault();
    setLeaveError('');
    setLeaveSaving(true);
    try {
      const res = await api.createLeave(leaveForm);
      setLeaves((current) => [res.data.leave, ...current]);
      setLeaveForm({ driverId: '', startDate: '', endDate: '', reason: '' });
      setShowAddLeaveForm(false);
    } catch (err) {
      setLeaveError(err.response?.data?.error || 'Failed to add leave entry');
    } finally {
      setLeaveSaving(false);
    }
  }

  async function removeLeave(leaveId) {
    if (!window.confirm('Delete this leave entry?')) return;
    setLeaveError('');
    try {
      await api.deleteLeave(leaveId);
      setLeaves((current) => current.filter((leave) => leave._id !== leaveId));
    } catch (err) {
      setLeaveError(err.response?.data?.error || 'Failed to delete leave entry');
    }
  }

  function startEditLeave(leave) {
    setLeaveEditId(leave._id);
    setLeaveEditForm({
      startDate: new Date(leave.startDate).toISOString().slice(0, 10),
      endDate: leave.endDate ? new Date(leave.endDate).toISOString().slice(0, 10) : '',
      reason: leave.reason || '',
    });
    setLeaveError('');
  }

  function cancelEditLeave() {
    setLeaveEditId('');
    setLeaveEditForm({ startDate: '', endDate: '', reason: '' });
  }

  async function saveLeaveEdit(event) {
    event.preventDefault();
    if (!leaveEditId) return;
    setLeaveError('');
    setLeaveEditSaving(true);
    try {
      const res = await api.updateLeave(leaveEditId, leaveEditForm);
      setLeaves((current) => current.map((leave) => (leave._id === leaveEditId ? res.data.leave : leave)));
      cancelEditLeave();
    } catch (err) {
      setLeaveError(err.response?.data?.error || 'Failed to update leave entry');
    } finally {
      setLeaveEditSaving(false);
    }
  }

  function editSelectedLeave() {
    if (selectedLeaves.length !== 1) return;
    const leave = leaves.find((entry) => entry._id === selectedLeaves[0]);
    if (leave) startEditLeave(leave);
  }

  async function deleteSelectedLeave() {
    if (selectedLeaves.length !== 1) return;
    await removeLeave(selectedLeaves[0]);
    setSelectedLeaves([]);
  }

  const archivedLeaves = leaves.filter((leave) => !isLeaveInCurrentOrPreviousMonth(leave));
  const visibleLeaves = showArchivedLeaves ? leaves : leaves.filter(isLeaveInCurrentOrPreviousMonth);

  return {
    leaveForm,
    setLeaveForm,
    leaveSaving,
    leaveEditId,
    leaveEditForm,
    setLeaveEditForm,
    leaveEditSaving,
    showArchivedLeaves,
    setShowArchivedLeaves,
    selectedLeaves,
    setSelectedLeaves,
    showAddLeaveForm,
    setShowAddLeaveForm,
    addLeave,
    removeLeave,
    startEditLeave,
    cancelEditLeave,
    saveLeaveEdit,
    editSelectedLeave,
    deleteSelectedLeave,
    archivedLeaves,
    visibleLeaves,
  };
}
