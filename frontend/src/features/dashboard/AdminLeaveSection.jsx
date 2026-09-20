import React from 'react';
import { useLeaveEntries } from './useLeaveEntries';

export default function AdminLeaveSection({ leaves, setLeaves, leavesLoading, leaveError, setLeaveError, driverUsers }) {
  const {
    leaveForm, setLeaveForm, leaveSaving, leaveEditId, leaveEditForm, setLeaveEditForm, leaveEditSaving,
    showArchivedLeaves, setShowArchivedLeaves, selectedLeaves, setSelectedLeaves, showAddLeaveForm, setShowAddLeaveForm,
    addLeave, cancelEditLeave, saveLeaveEdit, editSelectedLeave, deleteSelectedLeave, archivedLeaves, visibleLeaves,
  } = useLeaveEntries({ leaves, setLeaves, setLeaveError });

  return (
    <div className="card customer-admin-leave-section" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Leave Entries</h3>
      {leaveError && <p className="error-text">{leaveError}</p>}
      {leavesLoading ? <p>Loading leave entries...</p> : visibleLeaves.length === 0 ? (
        <p>No leave entries found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center', padding: '8px 12px' }}>Select</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Driver</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Start Date</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>End Date</th>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeaves.map((leave) => (
                <tr key={leave._id}>
                  {leaveEditId === leave._id ? (
                    <td colSpan={6} style={{ padding: '8px 12px' }}>
                      <form onSubmit={saveLeaveEdit}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Start Date</label>
                            <input type="date" value={leaveEditForm.startDate} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, startDate: e.target.value })} required />
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>End Date</label>
                            <input type="date" value={leaveEditForm.endDate} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, endDate: e.target.value })} required />
                          </div>
                          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                            <label>Reason (optional)</label>
                            <input value={leaveEditForm.reason} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, reason: e.target.value })} />
                          </div>
                          <button className="btn" disabled={leaveEditSaving} type="submit">
                            {leaveEditSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button type="button" className="btn secondary" onClick={cancelEditLeave}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedLeaves.includes(leave._id)}
                          onChange={() => setSelectedLeaves((current) => (
                            current.includes(leave._id)
                              ? current.filter((id) => id !== leave._id)
                              : [...current, leave._id]
                          ))}
                          aria-label="Select leave entry"
                          style={{ width: 'auto' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>{leave.driver?.name || leave.driver?.username || 'Unknown driver'}</td>
                      <td style={{ padding: '8px 12px' }}>{new Date(leave.startDate).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '8px 12px' }}>{leave.endDate ? new Date(leave.endDate).toLocaleDateString('en-IN') : '-'}</td>
                      <td style={{ padding: '8px 12px' }}>{leave.reason || '-'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {archivedLeaves.length > 0 && (
        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: 12 }}
          onClick={() => setShowArchivedLeaves((current) => !current)}
        >
          {showArchivedLeaves ? 'Hide archived leaves' : `View archived leaves (${archivedLeaves.length})`}
        </button>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="btn" onClick={() => setShowAddLeaveForm((current) => !current)}>
          {showAddLeaveForm ? 'Close Add' : 'Add'}
        </button>
        <button type="button" className="btn secondary" disabled={selectedLeaves.length !== 1} onClick={editSelectedLeave}>
          Edit
        </button>
        <button type="button" className="btn danger" disabled={selectedLeaves.length !== 1} onClick={deleteSelectedLeave}>
          Delete
        </button>
      </div>
      {showAddLeaveForm && <form onSubmit={addLeave} style={{ marginTop: 20 }}>
        <h4 style={{ marginTop: 0 }}>Apply Leave</h4>
        <div className="grid-2">
          <div className="field">
            <label>Driver</label>
            <select value={leaveForm.driverId} onChange={(e) => setLeaveForm({ ...leaveForm, driverId: e.target.value })} required>
              <option value="">Select driver...</option>
              {driverUsers.map((driver) => (
                <option key={driver.id || driver._id} value={driver.id || driver._id}>{driver.name || driver.username}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Reason (optional)</label>
            <input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Start Date</label>
            <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required />
          </div>
          <div className="field">
            <label>End Date</label>
            <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required />
          </div>
        </div>
        <button className="btn" disabled={leaveSaving} type="submit">
          {leaveSaving ? 'Saving...' : 'Apply Leave'}
        </button>
      </form>}
    </div>
  );
}
