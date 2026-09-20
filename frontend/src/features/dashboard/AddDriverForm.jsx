import React from 'react';

export default function AddDriverForm({ driverForm, setDriverForm, vehicles, driverError, driverSaving, onSubmit }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Add Driver and Link Vehicle</h3>
      <form onSubmit={onSubmit}>
        <div className="grid-2">
          <div className="field">
            <label>Driver Name</label>
            <input value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Mobile Number</label>
            <input value={driverForm.mobileNumber} onChange={(e) => setDriverForm({ ...driverForm, mobileNumber: e.target.value })} required />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Joining Date</label>
            <input type="date" value={driverForm.joiningDate} onChange={(e) => setDriverForm({ ...driverForm, joiningDate: e.target.value })} />
          </div>
          <div className="field">
            <label>Resigning Date</label>
            <input type="date" value={driverForm.resigningDate} onChange={(e) => setDriverForm({ ...driverForm, resigningDate: e.target.value })} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Login Username</label>
            <input
              autoComplete="off"
              value={driverForm.username}
              onChange={(e) => setDriverForm({ ...driverForm, username: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Login Password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={driverForm.password}
              onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="field">
          <label>Link to Vehicle (optional)</label>
          <select value={driverForm.vehicleId} onChange={(e) => setDriverForm({ ...driverForm, vehicleId: e.target.value })}>
            <option value="">Select vehicle...</option>
            {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNumber}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'end' }}>
          <div className="field">
            <label>Basic Salary</label>
            <input type="number" min="0" step="0.01" value={driverForm.basicSalary} onChange={(e) => setDriverForm({ ...driverForm, basicSalary: e.target.value })} />
          </div>
          <div className="field">
            <label>KM Charges</label>
            <input type="number" min="0" step="0.01" value={driverForm.kmCharges} onChange={(e) => setDriverForm({ ...driverForm, kmCharges: e.target.value })} />
          </div>
          <div className="field">
            <label>Less than 200KM Charges</label>
            <input type="number" min="0" step="0.01" value={driverForm.minKmCharges} onChange={(e) => setDriverForm({ ...driverForm, minKmCharges: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={driverForm.temporaryDriverRequired}
              onChange={(e) => setDriverForm({ ...driverForm, temporaryDriverRequired: e.target.checked })}
              style={{ width: 'auto' }}
            />
            Temporary Driver
          </label>
        </div>
        {driverForm.temporaryDriverRequired && (
          <div className="grid-2">
            <div className="field">
              <label>Temporary Driver Name</label>
              <input value={driverForm.temporaryDriverName} onChange={(e) => setDriverForm({ ...driverForm, temporaryDriverName: e.target.value })} required />
            </div>
            <div className="field">
              <label>Joining Date</label>
              <input type="date" value={driverForm.temporaryDriverJoiningDate} onChange={(e) => setDriverForm({ ...driverForm, temporaryDriverJoiningDate: e.target.value })} required />
            </div>
            <div className="field">
              <label>Returning Date</label>
              <input type="date" value={driverForm.temporaryDriverReturningDate} onChange={(e) => setDriverForm({ ...driverForm, temporaryDriverReturningDate: e.target.value })} min={driverForm.temporaryDriverJoiningDate || undefined} />
            </div>
          </div>
        )}
        {driverError && <div className="error-text">{driverError}</div>}
        <button className="btn" disabled={driverSaving}>
          {driverSaving ? 'Adding...' : 'Add Driver'}
        </button>
      </form>
    </div>
  );
}
