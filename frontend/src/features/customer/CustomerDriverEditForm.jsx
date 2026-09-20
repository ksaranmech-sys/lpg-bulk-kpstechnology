import React from 'react';

export default function CustomerDriverEditForm({ driverEditForm, setDriverEditForm, vehicles, driverEditError, driverEditSaving, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit}>
      <h4 style={{ marginTop: 0 }}>Edit Driver</h4>
      <div className="grid-2">
        <div className="field">
          <label>Driver Name</label>
          <input value={driverEditForm.name} onChange={(e) => setDriverEditForm({ ...driverEditForm, name: e.target.value })} required />
        </div>
        <div className="field">
          <label>Mobile Number</label>
          <input value={driverEditForm.mobileNumber} onChange={(e) => setDriverEditForm({ ...driverEditForm, mobileNumber: e.target.value })} required />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Joining Date</label>
          <input type="date" value={driverEditForm.joiningDate} onChange={(e) => setDriverEditForm({ ...driverEditForm, joiningDate: e.target.value })} />
        </div>
        <div className="field">
          <label>Resigning Date</label>
          <input type="date" value={driverEditForm.resigningDate} onChange={(e) => setDriverEditForm({ ...driverEditForm, resigningDate: e.target.value })} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Login Username</label>
          <input autoComplete="off" value={driverEditForm.username} onChange={(e) => setDriverEditForm({ ...driverEditForm, username: e.target.value })} required />
        </div>
        <div className="field">
          <label>Login Password</label>
          <input type="password" autoComplete="new-password" value={driverEditForm.password} onChange={(e) => setDriverEditForm({ ...driverEditForm, password: e.target.value })} placeholder="Leave blank to keep current password" />
        </div>
      </div>
      <div className="field">
        <label>Assigned Vehicle</label>
        <select value={driverEditForm.vehicleId} onChange={(e) => setDriverEditForm({ ...driverEditForm, vehicleId: e.target.value })}>
          <option value="">Unassigned</option>
          {vehicles?.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNumber}</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Basic Salary</label>
          <input type="number" min="0" step="0.01" value={driverEditForm.basicSalary} onChange={(e) => setDriverEditForm({ ...driverEditForm, basicSalary: e.target.value })} required />
        </div>
        <div className="field">
          <label>KM Charges</label>
          <input type="number" min="0" step="0.01" value={driverEditForm.kmCharges} onChange={(e) => setDriverEditForm({ ...driverEditForm, kmCharges: e.target.value })} required />
        </div>
        <div className="field">
          <label>Less than 200KM Charges</label>
          <input type="number" min="0" step="0.01" value={driverEditForm.minKmCharges} onChange={(e) => setDriverEditForm({ ...driverEditForm, minKmCharges: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={driverEditForm.temporaryDriverRequired}
            onChange={(e) => setDriverEditForm({ ...driverEditForm, temporaryDriverRequired: e.target.checked })}
            style={{ width: 'auto' }}
          />
          Temporary Driver
        </label>
      </div>
      {driverEditForm.temporaryDriverRequired && (
        <div className="grid-2">
          <div className="field">
            <label>Temporary Driver Name</label>
            <input value={driverEditForm.temporaryDriverName} onChange={(e) => setDriverEditForm({ ...driverEditForm, temporaryDriverName: e.target.value })} required />
          </div>
          <div className="field">
            <label>Joining Date</label>
            <input type="date" value={driverEditForm.temporaryDriverJoiningDate} onChange={(e) => setDriverEditForm({ ...driverEditForm, temporaryDriverJoiningDate: e.target.value })} required />
          </div>
          <div className="field">
            <label>Returning Date</label>
            <input type="date" value={driverEditForm.temporaryDriverReturningDate} onChange={(e) => setDriverEditForm({ ...driverEditForm, temporaryDriverReturningDate: e.target.value })} min={driverEditForm.temporaryDriverJoiningDate || undefined} />
          </div>
        </div>
      )}
      {driverEditError && <div className="error-text">{driverEditError}</div>}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn" disabled={driverEditSaving} type="submit">
          {driverEditSaving ? 'Saving...' : 'Save Driver'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
