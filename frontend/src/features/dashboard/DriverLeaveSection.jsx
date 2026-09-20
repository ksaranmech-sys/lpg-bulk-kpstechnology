import React from 'react';
import { useLeaveEntries } from './useLeaveEntries';

export default function DriverLeaveSection({ leaves, setLeaves, leavesLoading, leaveError, setLeaveError }) {
  const {
    leaveForm, setLeaveForm, leaveSaving, leaveEditId, leaveEditForm, setLeaveEditForm, leaveEditSaving,
    showArchivedLeaves, setShowArchivedLeaves, addLeave, removeLeave, startEditLeave, cancelEditLeave, saveLeaveEdit,
    archivedLeaves, visibleLeaves,
  } = useLeaveEntries({ leaves, setLeaves, setLeaveError });

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Leave Entries</h3>
      {leaveError && <div className="error-text" style={{ marginBottom: 12 }}>{leaveError}</div>}
      {leavesLoading ? <p>Loading leave entries...</p> : visibleLeaves.length === 0 ? (
        <p>No leave entries found.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          {visibleLeaves.map((leave) => (
            <div key={leave._id} className="list-item" style={{ display: 'block' }}>
              {leaveEditId === leave._id ? (
                <form onSubmit={saveLeaveEdit}>
                  <div className="grid-2">
                    <div className="field">
                      <label>Start Date</label>
                      <input type="date" value={leaveEditForm.startDate} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, startDate: e.target.value })} required />
                    </div>
                    <div className="field">
                      <label>End Date</label>
                      <input type="date" value={leaveEditForm.endDate} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, endDate: e.target.value })} required />
                    </div>
                  </div>
                  <div className="field">
                    <label>Reason (optional)</label>
                    <input value={leaveEditForm.reason} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, reason: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" disabled={leaveEditSaving} type="submit">
                      {leaveEditSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="btn secondary" onClick={cancelEditLeave}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <strong>{new Date(leave.startDate).toLocaleDateString('en-IN')} - {leave.endDate ? new Date(leave.endDate).toLocaleDateString('en-IN') : '-'}</strong>
                    <div style={{ fontSize: 12, color: '#666' }}>{leave.reason || 'No reason provided'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button type="button" className="btn secondary" onClick={() => startEditLeave(leave)}>Edit</button>
                    <button type="button" className="btn danger" onClick={() => removeLeave(leave._id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {archivedLeaves.length > 0 && (
        <button
          type="button"
          className="btn secondary"
          style={{ marginBottom: 20 }}
          onClick={() => setShowArchivedLeaves((current) => !current)}
        >
          {showArchivedLeaves ? 'Hide archived leaves' : `View archived leaves (${archivedLeaves.length})`}
        </button>
      )}
      <form onSubmit={addLeave}>
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
        <div className="field">
          <label>Reason (optional)</label>
          <input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
        </div>
        <button className="btn" disabled={leaveSaving} type="submit">
          {leaveSaving ? 'Saving...' : 'Add Leave'}
        </button>
      </form>
    </div>
  );
}
