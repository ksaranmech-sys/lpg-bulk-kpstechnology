import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';

export default function TripDetail() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [meta, setMeta] = useState({ loadingLocations: [], unloadingLocations: [], routeKmTable: [] });
  const [editingLoadingDetails, setEditingLoadingDetails] = useState(false);
  const [editingUnloadingDetails, setEditingUnloadingDetails] = useState(false);
  const [editingTurnDetails, setEditingTurnDetails] = useState(false);

  function load() {
    api.getTrip(tripId).then((res) => setTrip(res.data.trip));
    api.getMeta().then((res) => setMeta(res.data));
  }
  useEffect(load, [tripId]);

  if (!trip) return <Layout><p>Loading...</p></Layout>;

  const isTripLocked = trip.status !== 'open';
  const hasLoadingDetails = Boolean(trip.loadingLocation && trip.loadingDate);
  const hasLoadingExpense = Number(trip.loadingExpense) > 0 || Number(trip.parkingExpense) > 0 || Number(trip.turnExpense) > 0;
  const hasUnloadingDetails = Boolean(trip.unloadingLocation && trip.unloadingDate);
  const hasTurnDetails = trip.turnNumber != null && trip.turnDate;
  const hasUnloadingTurnDetails = trip.unTurnNumber != null && trip.unTurnDate;
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const loadingDateText = formatDate(trip.loadingDate);
  const unloadingDateText = formatDate(trip.unloadingDate);

  const routeUnloadingOptions = Array.from(new Set((meta.routeKmTable || []).map((row) => row.unloadingLocation).filter(Boolean)));

  return (
    <Layout>
      <Link to="/">&larr; Back to vehicles and trips</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Trip: {trip.loadingLocation}{loadingDateText ? ` (${loadingDateText})` : ''} &rarr; {trip.unloadingLocation || '(unloading pending)'}{unloadingDateText ? ` (${unloadingDateText})` : ''}
          {trip.isDiverted && trip.divertUnloadingLocation ? ` \u2192 ${trip.divertUnloadingLocation}${trip.divertDate ? ` (${formatDate(trip.divertDate)})` : ''} - Divert` : ''}
        </h2>
        <span className={`badge ${trip.status}`}>{trip.status}</span>
      </div>
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <p style={{ color: '#666', margin: 0 }}>
          Customer: {trip.customer?.companyName || 'Unknown'}
        </p>
      </div>

      <fieldset disabled={isTripLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <>
        <AdvanceSection trip={trip} tripId={tripId} onSaved={load} />
        {hasLoadingDetails && (
          <LoadingDetailsSummary trip={trip} onEdit={() => setEditingLoadingDetails(true)} />
        )}
        {(!hasLoadingDetails || editingLoadingDetails) && (
          <LoadingDetailsForm
            tripId={tripId}
            trip={trip}
            meta={meta}
            onSaved={() => { setEditingLoadingDetails(false); load(); }}
          />
        )}
        {hasLoadingExpense && <LoadingExpenseSummary trip={trip} tripId={tripId} onSaved={load} />}
        {!hasLoadingExpense && <LoadingExpenseForm tripId={tripId} trip={trip} onSaved={load} />}
        <div className="card">
          <DieselSummary trip={trip} tripId={tripId} onSaved={load} />
          <div style={{ marginTop: 14 }}>
            <DieselForm tripId={tripId} onSaved={load} title="" />
          </div>
        </div>
        <div className="card">
          <RtoSummary trip={trip} onSaved={load} />
          <div style={{ marginTop: 14 }}>
            <RtoForm tripId={tripId} onSaved={load} />
          </div>
        </div>
        {hasUnloadingTurnDetails ? (
          <UnloadingTurnSummary trip={trip} onDeleted={load} />
        ) : (
          <UnloadingTurnForm tripId={tripId} trip={trip} onSaved={load} />
        )}
        {hasUnloadingDetails && <UnloadingDetailsSummary trip={trip} onEdit={() => setEditingUnloadingDetails(true)} />}
        {(!hasUnloadingDetails || editingUnloadingDetails) && (
          <UnloadingForm
            tripId={tripId}
            meta={meta}
            trip={trip}
            routeUnloadingOptions={routeUnloadingOptions}
            onSaved={() => { setEditingUnloadingDetails(false); load(); }}
          />
        )}
        <div className="card">
          <OtherExpenseSummary trip={trip} tripId={tripId} onSaved={load} />
          <div style={{ marginTop: 14 }}>
            <OtherExpenseForm tripId={tripId} onSaved={load} />
          </div>
        </div>
        {hasTurnDetails && <TurnDetailsSummary trip={trip} onEdit={() => setEditingTurnDetails(true)} />}
        {(!hasTurnDetails || editingTurnDetails) && (
          <TurnDetailsForm
            tripId={tripId}
            trip={trip}
            meta={meta}
            onSaved={() => { setEditingTurnDetails(false); load(); }}
          />
        )}
        </>

      </fieldset>
      <EntriesSummary
        trip={trip}
        corporationKm={(meta.routeKmTable || []).find((row) => (
          String(row.loadingLocation || '').trim() === String(trip.loadingLocation || '').trim() &&
          String(row.unloadingLocation || '').trim() === String(trip.unloadingLocation || '').trim()
        ))?.km}
        calculatedCorporationKm={trip.corporationKm}
      />
    </Layout>
  );
}

function AdvanceSection({ trip, tripId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [error, setError] = useState('');
  const advances = trip.driverAdvances || [];

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.addAdvance(tripId, { amount: Number(amount), date: date || undefined });
      setAmount(''); setDate('');
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add advance');
    }
  }

  function startEdit(index, advance) {
    setEditingIndex(index);
    setEditAmount(String(advance.amount));
    setEditDate(new Date(advance.date).toISOString().slice(0, 10));
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateAdvance(trip._id, index, { amount: Number(editAmount), date: editDate });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update advance');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Advance</h3>
      {error && <div className="error-text">{error}</div>}
      {advances.length > 0 && (
        <table>
          <thead><tr><th>Amount</th><th style={{ textAlign: 'center' }}>Date</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {advances.map((advance, i) => (
              <tr key={i}>
                {editingIndex === i ? (
                  <>
                    <td><input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} min="0" /></td>
                    <td style={{ textAlign: 'center' }}><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn" onClick={() => saveEdit(i)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>Rs {advance.amount}</td>
                    <td style={{ textAlign: 'center' }}>{new Date(advance.date).toLocaleDateString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn secondary" onClick={() => startEdit(i, advance)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={submit} style={{ border: 0, background: 'transparent', padding: 0, borderRadius: 0, marginTop: advances.length ? 16 : 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          <div className="field" style={{ margin: 0 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Add</button>
        </div>
      </form>
    </div>
  );
}

function LoadingDetailsForm({ tripId, trip, meta, onSaved }) {
  const [loadingLocation, setLocation] = useState(trip.loadingLocation || '');
  const [loadingDate, setDate] = useState(trip.loadingDate ? new Date(trip.loadingDate).toISOString().slice(0, 10) : '');
  const loadingOptions = Array.from(new Set((meta.routeKmTable || []).map((row) => row.loadingLocation).filter(Boolean)));

  async function submit(e) {
    e.preventDefault();
    await api.setLoadingDetails(tripId, { loadingLocation, loadingDate });
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Loading Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Loading Location</label>
          <select value={loadingLocation} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Select Loading location</option>
            {loadingOptions.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Or Enter Manually</label>
          <input
            value={loadingLocation}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter loading location"
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Date of loading</label>
          <input type="date" value={loadingDate} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Save</button>
      </div>
    </form>
  );
}

function LoadingDetailsSummary({ trip, onEdit }) {
  return (
    <div className="card">
      <h3 className="section-title">Loading location</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
            <strong>{trip.loadingLocation || '-'}</strong>
          </span>
          <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14, color: '#64748b' }}>
            {trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

function LoadingExpenseForm({ tripId, trip, onSaved }) {
  const [amount, setAmount] = useState(trip.loadingExpense || '');
  const [parking, setParking] = useState(trip.parkingExpense || '');
  const [turn, setTurn] = useState(trip.turnExpense || '');
  const [photo, setPhoto] = useState(null);

  async function submit(e) {
    e.preventDefault();
    await api.setLoadingDetailsWithPhoto(
      tripId,
      {
        loadingExpense: Number(amount || 0),
        parkingExpense: Number(parking || 0),
        turnExpense: Number(turn || 0),
      },
      photo
    );
    setPhoto(null);
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Expenses</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Loading Cleaner Expense (Rs)</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Parking (Rs)</label>
          <input type="number" min="0" value={parking} onChange={(e) => setParking(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Parking Photo</label>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Turn (Rs)</label>
          <input type="number" min="0" value={turn} onChange={(e) => setTurn(e.target.value)} />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Save</button>
      </div>
    </form>
  );
}

function LoadingExpenseSummary({ trip, tripId, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(trip.loadingExpense || ''));
  const [parking, setParking] = useState(String(trip.parkingExpense || ''));
  const [turn, setTurn] = useState(String(trip.turnExpense || ''));
  const [error, setError] = useState('');

  async function saveEdit() {
    setError('');
    try {
      await api.setLoadingDetails(tripId, {
        loadingExpense: Number(amount || 0),
        parkingExpense: Number(parking || 0),
        turnExpense: Number(turn || 0),
      });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update loading expense');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Expenses</h3>
      {error && <div className="error-text">{error}</div>}
      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Loading Cleaner Expense (Rs)</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Parking (Rs)</label>
            <input type="number" min="0" value={parking} onChange={(e) => setParking(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Turn (Rs)</label>
            <input type="number" min="0" value={turn} onChange={(e) => setTurn(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
            <button type="button" className="btn" onClick={saveEdit}>Save</button>{' '}
            <button type="button" className="btn secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
              <span style={{ color: '#64748b' }}>Cleaner</span> <strong>Rs {trip.loadingExpense || 0}</strong>
            </span>
            <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
              <span style={{ color: '#64748b' }}>Parking</span> <strong>Rs {trip.parkingExpense || 0}</strong>
            </span>
            <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
              <span style={{ color: '#64748b' }}>Turn</span> <strong>Rs {trip.turnExpense || 0}</strong>
            </span>
            {trip.parkingPhoto?.url && (
              <a href={trip.parkingPhoto.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef7f4', border: '1px solid #bfe3da', borderRadius: 8, padding: '6px 12px', fontSize: 14, textDecoration: 'none' }}>
                <img src={trip.parkingPhoto.url} alt="Parking" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 6 }} />
                <span>Photo</span>
              </a>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn secondary" onClick={() => setEditing(true)}>Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TurnDetailsForm({ tripId, trip, meta, onSaved }) {
  const [turnNumber, setTurnNumber] = useState(trip.turnNumber != null ? String(trip.turnNumber) : '');
  const [turnDate, setTurnDate] = useState(trip.turnDate ? new Date(trip.turnDate).toISOString().slice(0, 10) : '');
  const [fillingOrderLocation, setFillingOrderLocation] = useState(trip.fillingOrderLocation || '');
  const [manualKm, setManualKm] = useState(trip.manualKm != null ? String(trip.manualKm) : '');
  const [showManualKmModal, setShowManualKmModal] = useState(false);
  const [error, setError] = useState('');
  const missingCloseFields = [
    !String(trip.loadingLocation || '').trim() && 'loading location',
    !trip.loadingDate && 'loading date',
    !String(trip.unloadingLocation || '').trim() && 'unloading location',
    !trip.unloadingDate && 'unloading date',
  ].filter(Boolean);
  const loadingLocations = Array.from(new Set((meta.routeKmTable || []).map((row) => row.loadingLocation).filter(Boolean)));
  const manualKmRequired = trip.corporationKmSource === 'manual_required';
  const manualKmFromLocation = trip.isDiverted ? trip.unloadingLocation : trip.loadingLocation;
  const manualKmToLocation = trip.isDiverted ? trip.divertUnloadingLocation : trip.unloadingLocation;

  async function submit(e) {
    e.preventDefault();
    if (missingCloseFields.length > 0) {
      setError(`Add ${missingCloseFields.join(', ')} before closing this trip.`);
      return;
    }
    if (manualKmRequired && manualKm === '') {
      setShowManualKmModal(true);
      return;
    }
    setError('');
    try {
      await api.setTurnDetails(tripId, {
        turnNumber: Number(turnNumber),
        turnDate,
        fillingOrderLocation: fillingOrderLocation || undefined,
        manualKm: manualKm === '' ? undefined : Number(manualKm),
      });
      await api.closeTrip(tripId);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save Turn details or close trip');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Load Turn</h3>
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.9fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Filling Order Location</label>
          <select value={fillingOrderLocation} onChange={(e) => setFillingOrderLocation(e.target.value)}>
            <option value="">Select loading location...</option>
            {loadingLocations.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Or Enter Manually</label>
          <input
            value={fillingOrderLocation}
            onChange={(e) => setFillingOrderLocation(e.target.value)}
            placeholder="Enter filling order location"
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Turn Number</label>
          <input type="number" min="0" step="1" value={turnNumber} onChange={(e) => setTurnNumber(e.target.value)} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Turn Date</label>
          <input type="date" value={turnDate} onChange={(e) => setTurnDate(e.target.value)} required />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }} disabled={missingCloseFields.length > 0}>Trip close</button>
      </div>
      {missingCloseFields.length > 0 && (
        <p className="error-text" style={{ marginTop: 12 }}>
          Add {missingCloseFields.join(', ')} before closing this trip.
        </p>
      )}
      {manualKm !== '' && (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn secondary" onClick={() => setShowManualKmModal(true)}>
            Edit Manual KM
          </button>
        </div>
      )}
      {showManualKmModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="manual-km-title">
          <div className="card modal-panel" style={{ width: '100%', maxWidth: 420, margin: 20 }}>
            <h3 id="manual-km-title" className="section-title">Enter Manual KM(Round-trip)</h3>
            <div className="grid-2">
              <div className="field">
                <label>Loading Location</label>
                <input value={manualKmFromLocation || '-'} readOnly />
              </div>
              <div className="field">
                <label>Unloading Location</label>
                <input value={manualKmToLocation || '-'} readOnly />
              </div>
            </div>
            <div className="field">
              <label>Manual KM</label>
              <input
                type="number"
                min="0"
                value={manualKm}
                onChange={(e) => setManualKm(e.target.value)}
                autoFocus
                required={manualKmRequired}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn secondary" onClick={() => setShowManualKmModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function TurnDetailsSummary({ trip, onEdit }) {
  return (
    <div className="card">
      <h3 className="section-title">Load Turn Added</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <p style={{ margin: 0 }}>
          Turn {trip.turnNumber} • {new Date(trip.turnDate).toLocaleDateString('en-IN')}
          {trip.fillingOrderLocation ? ` • Filling order: ${trip.fillingOrderLocation}` : ''}
          {trip.manualKm != null && trip.manualKm !== '' ? ` • Manual KM: ${trip.manualKm}` : ''}
        </p>
        <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}

function UnloadingTurnForm({ tripId, trip, onSaved }) {
  const [turnNumber, setTurnNumber] = useState(trip.unTurnNumber != null ? String(trip.unTurnNumber) : '');
  const [turnDate, setTurnDate] = useState(trip.unTurnDate ? new Date(trip.unTurnDate).toISOString().slice(0, 10) : '');

  async function submit(e) {
    e.preventDefault();
    await api.setUnloadingTurnDetails(tripId, { turnNumber: Number(turnNumber), turnDate });
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Unload Turn</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Turn Number</label>
          <input type="number" min="0" step="1" value={turnNumber} onChange={(e) => setTurnNumber(e.target.value)} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Turn Date</label>
          <input type="date" value={turnDate} onChange={(e) => setTurnDate(e.target.value)} required />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Save</button>
      </div>
    </form>
  );
}

function UnloadingTurnSummary({ trip, onDeleted }) {
  async function deleteTurn() {
    if (!window.confirm('Delete this Unload Turn?')) return;
    await api.deleteUnloadingTurnDetails(trip._id);
    onDeleted();
  }

  return (
    <div className="card">
      <h3 className="section-title">Unload Turn</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
            <span style={{ color: '#64748b' }}>Turn</span> <strong>{trip.unTurnNumber}</strong>
          </span>
          <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14, color: '#64748b' }}>
            {new Date(trip.unTurnDate).toLocaleDateString('en-IN')}
          </span>
        </div>
        <button type="button" className="btn danger" onClick={deleteTurn}>Delete</button>
      </div>
    </div>
  );
}

function DieselForm({
  tripId,
  onSaved,
  title = 'Diesel Filling Entry',
  submitLabel = 'Add',
  closeAfterSave = false,
}) {
  const [volumeLitres, setVolume] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('diesel_card');
  const [odometerKm, setOdo] = useState('');
  const [filledAt, setFilledAt] = useState('');
  const [photo, setPhoto] = useState(null);
  const [dieselFilledConfirmed, setDieselFilledConfirmed] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const gps = await api.getCurrentPosition();
    await api.addDieselEntry(
      tripId,
      { volumeLitres, totalValue, paymentMethod, loadingPointTankFill: dieselFilledConfirmed, odometerKm: odometerKm || undefined, filledAt: filledAt || undefined, lat: gps?.lat, lng: gps?.lng },
      photo
    );
    setVolume(''); setTotalValue(''); setPaymentMethod('diesel_card'); setOdo(''); setFilledAt(''); setPhoto(null); setDieselFilledConfirmed(false);
    if (closeAfterSave) {
      await onSaved();
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} style={{ padding: '0', margin: 0, border: 0, background: 'transparent', borderRadius: 0 }}>
      {title ? <h3 className="section-title">{title}</h3> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}><label>Volume (Litres)</label><input type="number" value={volumeLitres} onChange={(e) => setVolume(e.target.value)} required /></div>
        <div className="field" style={{ margin: 0 }}><label>Total Value (Rs)</label><input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} required /></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Payment Method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="diesel_card">Diesel Card</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Tank Fill</label>
          <div style={{ display: 'flex', alignItems: 'center', height: 42, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <input
              type="checkbox"
              style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--green-500)', cursor: 'pointer' }}
              checked={dieselFilledConfirmed}
              onChange={(e) => setDieselFilledConfirmed(e.target.checked)}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end', marginTop: 12 }}>
        <div className="field" style={{ margin: 0 }}><label>Odometer Reading</label><input type="number" value={odometerKm} onChange={(e) => setOdo(e.target.value)} placeholder="Optional" /></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Date</label>
          <input type="date" value={filledAt} onChange={(e) => setFilledAt(e.target.value)} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn" type="submit" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>{submitLabel}</button>
      </div>
    </form>
  );
}

function DieselSummary({ trip, tripId, onSaved }) {
  const entries = trip.dieselEntries || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [volume, setVolume] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('diesel_card');
  const [loadingPointTankFill, setLoadingPointTankFill] = useState(false);
  const [odometerKm, setOdometerKm] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  function startEdit(index, entry) {
    setEditingIndex(index);
    setVolume(String(entry.volumeLitres));
    setTotalValue(String(entry.amount));
    setPaymentMethod(entry.paymentMethod || 'diesel_card');
    setLoadingPointTankFill(Boolean(entry.loadingPointTankFill));
    setOdometerKm(entry.odometerKm == null ? '' : String(entry.odometerKm));
    setDate(entry.filledAt ? new Date(entry.filledAt).toISOString().slice(0, 10) : '');
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateDieselEntry(tripId, index, {
        volumeLitres: Number(volume),
        totalValue: Number(totalValue),
        paymentMethod,
        loadingPointTankFill,
        odometerKm: odometerKm === '' ? undefined : Number(odometerKm),
        filledAt: date || undefined,
      });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update diesel entry');
    }
  }

  return (
    <div>
      <h3 className="section-title">Diesel</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? null : (
        <table>
          <thead><tr><th>Volume (L)</th><th>Total Value</th><th>Odometer KM</th><th>Date</th><th>Payment</th><th>Tank Fill</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} min="0" /></td>
                    <td><input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} min="0" /></td>
                    <td><input type="number" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} min="0" /></td>
                    <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="diesel_card">Diesel Card</option>
                        <option value="cash">Cash</option>
                      </select>
                    </td>
                    <td>
                      <label className="tank-fill-control" style={{ justifyContent: 'flex-start' }}>
                        <input type="checkbox" checked={loadingPointTankFill} onChange={(e) => setLoadingPointTankFill(e.target.checked)} />
                        Tank Fill
                      </label>
                    </td>
                    <td>
                      <button type="button" className="btn" onClick={() => saveEdit(index)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{entry.volumeLitres}</td>
                    <td>Rs {entry.amount}</td>
                    <td>{entry.odometerKm ?? '-'}</td>
                    <td>{new Date(entry.filledAt).toLocaleDateString('en-IN')}</td>
                    <td>{entry.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card'}</td>
                    <td>{entry.loadingPointTankFill ? '✓' : '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn secondary" onClick={() => startEdit(index, entry)}>Edit</button>{' '}
                      <button
                        type="button"
                        className="btn danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this diesel entry?')) return;
                          await api.deleteDieselEntry(tripId, index);
                          onSaved();
                        }}
                      >Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RtoSummary({ trip, onSaved }) {
  const entries = trip.rtoEntries || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  function startEdit(index, entry) {
    setEditingIndex(index);
    setAmount(String(entry.amount));
    setDate(entry.date ? new Date(entry.date).toISOString().slice(0, 10) : '');
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateRtoEntry(trip._id, index, { amount: Number(amount), date });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update RTO expense');
    }
  }

  return (
    <div>
      <h3 className="section-title">RTO Expenses</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? null : (
        <table>
          <thead><tr><th>Amount</th><th>Date</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></td>
                    <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn" onClick={() => saveEdit(index)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>Rs {entry.amount}</td>
                    <td>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn secondary" onClick={() => startEdit(index, entry)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RtoForm({ tripId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const gps = await api.getCurrentPosition();
    await api.addRtoEntry(tripId, { amount, date: date || undefined, lat: gps?.lat, lng: gps?.lng }, photo);
    setAmount(''); setDate(''); setPhoto(null);
    onSaved();
  }

  return (
    <form onSubmit={submit} style={{ border: 0, background: 'transparent', padding: 0, borderRadius: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div className="field" style={{ margin: 0 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Photo (GPS auto)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Add</button>
      </div>
    </form>
  );
}

const OTHER_EXPENSE_CATEGORIES = ['Unloading Cleaner', 'AdBlue', 'Puncture', 'Firegun'];

function OtherExpenseForm({ tripId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    const description = category === 'other' ? manualDescription.trim() : category;
    if (!description) {
      setError('Select a category or enter a description.');
      return;
    }
    setError('');
    const gps = await api.getCurrentPosition();
    await api.addOtherExpense(tripId, { amount, date: date || undefined, description, lat: gps?.lat, lng: gps?.lng }, photo);
    setAmount(''); setDate(''); setCategory(''); setManualDescription(''); setPhoto(null);
    onSaved();
  }

  return (
    <form onSubmit={submit} style={{ border: 0, background: 'transparent', padding: 0, borderRadius: 0 }}>
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Select...</option>
            {OTHER_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Or Enter Manually</label>
          <input
            value={category === 'other' ? manualDescription : category}
            onChange={(e) => { setCategory('other'); setManualDescription(e.target.value); }}
            placeholder="Enter description"
            disabled={category !== 'other' && category !== ''}
          />
        </div>
        <div className="field" style={{ margin: 0 }}><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div className="field" style={{ margin: 0 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Add</button>
      </div>
    </form>
  );
}

function OtherExpenseSummary({ trip, tripId, onSaved }) {
  const entries = trip.otherExpenses || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  function startEdit(index, entry) {
    setEditingIndex(index);
    setAmount(String(entry.amount));
    setDate(new Date(entry.date).toISOString().slice(0, 10));
    setDescription(entry.description || '');
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateOtherExpense(tripId, index, { amount: Number(amount), date, description });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update other expense');
    }
  }

  return (
    <div>
      <h3 className="section-title">Other Expenses</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No other expenses added yet.</p>
      ) : (
        <table>
          <thead><tr><th>Description</th><th>Amount</th><th>Date</th><th>Photo</th><th>Actions</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input value={description} onChange={(e) => setDescription(e.target.value)} /></td>
                    <td><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></td>
                    <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></td>
                    <td>{entry.photo?.url ? <a href={entry.photo.url} target="_blank" rel="noreferrer">view</a> : '-'}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => saveEdit(index)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{entry.description || '-'}</td>
                    <td>Rs {entry.amount}</td>
                    <td>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                    <td>{entry.photo?.url ? <a href={entry.photo.url} target="_blank" rel="noreferrer">view</a> : '-'}</td>
                    <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn secondary" onClick={() => startEdit(index, entry)}>Edit</button>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this other expense?')) return;
                          await api.deleteOtherExpense(tripId, index);
                          onSaved();
                        }}
                      >Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function UnloadingForm({ tripId, meta, trip, routeUnloadingOptions, onSaved }) {
  const [unloadingLocation, setLoc] = useState(trip.unloadingLocation || '');
  const [unloadingDate, setDate] = useState(trip.unloadingDate ? new Date(trip.unloadingDate).toISOString().slice(0, 10) : '');
  const [isDiverted, setIsDiverted] = useState(Boolean(trip.isDiverted));
  const [divertUnloadingLocation, setDivertUnloadingLocation] = useState(trip.divertUnloadingLocation || '');
  const [divertDate, setDivertDate] = useState(trip.divertDate ? new Date(trip.divertDate).toISOString().slice(0, 10) : '');
  const [divertKm, setDivertKm] = useState(trip.divertKm == null ? '' : String(trip.divertKm));
  const [showDivertKmModal, setShowDivertKmModal] = useState(false);
  const [selectedCorporation, setSelectedCorporation] = useState(
    (() => {
      const currentLocation = trip.unloadingLocation || unloadingLocation;
      if (!currentLocation) return '';
      const match = (meta.routeKmTable || []).find((row) => String(row?.unloadingLocation || '').trim() === String(currentLocation).trim());
      return match?.corporation || '';
    })()
  );

  const filteredUnloadingOptions = (routeUnloadingOptions || []).filter((loc) => {
    if (!selectedCorporation) return true;
    return (meta.routeKmTable || []).some((row) =>
      String(row?.unloadingLocation || '').trim() === String(loc).trim() &&
      String(row?.corporation || '').trim() === String(selectedCorporation).trim()
    );
  });

  async function submit(e) {
    e.preventDefault();
    const hasSecondLegInTable = (meta.routeKmTable || []).some((row) => (
      String(row?.loadingLocation || '').trim() === String(unloadingLocation || '').trim() &&
      String(row?.unloadingLocation || '').trim() === String(divertUnloadingLocation || '').trim()
    ));
    if (isDiverted && !hasSecondLegInTable && (!Number.isFinite(Number(divertKm)) || Number(divertKm) < 0)) {
      setShowDivertKmModal(true);
      return;
    }
    await api.setUnloading(tripId, {
      unloadingLocation,
      unloadingDate,
      isDiverted,
      divertUnloadingLocation: isDiverted ? divertUnloadingLocation : undefined,
      divertDate: isDiverted ? divertDate : undefined,
      divertKm: isDiverted ? Number(divertKm) : undefined,
    });
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Unloading Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Corporation</label>
          <select
            value={selectedCorporation}
            onChange={(e) => {
              const nextCorporation = e.target.value;
              setSelectedCorporation(nextCorporation);
              if (!nextCorporation) {
                setLoc('');
                return;
              }
              const available = (meta.routeKmTable || []).filter((row) => String(row?.corporation || '').trim() === String(nextCorporation).trim());
              const firstLocation = available[0]?.unloadingLocation || '';
              setLoc(firstLocation);
            }}
          >
            <option value="">Select corporation...</option>
            {(meta.routeKmTable || []).map((row) => row.corporation).filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).map((corporation) => (
              <option key={corporation} value={corporation}>{corporation}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Unloading Location</label>
          <select
            value={unloadingLocation}
            onChange={(e) => setLoc(e.target.value)}
          >
            <option value="">Select...</option>
            {(filteredUnloadingOptions || []).filter(Boolean).map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Or Enter Manually</label>
          <input
            value={unloadingLocation}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="Enter unloading location"
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Date</label>
          <input type="date" value={unloadingDate} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Divert</label>
          <div style={{ display: 'flex', alignItems: 'center', height: 42, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <input
              type="checkbox"
              style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--green-500)', cursor: 'pointer' }}
              checked={isDiverted}
              onChange={(e) => setIsDiverted(e.target.checked)}
            />
          </div>
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Save</button>
      </div>
      {isDiverted && (
        <div className="divert-fields" style={{ marginTop: 12 }}>
          <div className="field">
            <label>New Unloading Location</label>
            <select
              value={divertUnloadingLocation}
              onChange={(e) => setDivertUnloadingLocation(e.target.value)}
              required
            >
              <option value="">Select...</option>
              {(routeUnloadingOptions || []).filter(Boolean).map((loc) => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <div className="field">
            <label>New Unloading Date</label>
            <input type="date" value={divertDate} onChange={(e) => setDivertDate(e.target.value)} required />
          </div>
        </div>
      )}
      {showDivertKmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="divert-km-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 10, display: 'grid', placeItems: 'center',
            padding: 16, background: 'rgba(0, 0, 0, 0.35)',
          }}
        >
          <div className="card" style={{ width: 'min(100%, 360px)', margin: 0, background: '#fff' }}>
            <h3 id="divert-km-title" className="section-title">Divert location KM from here</h3>
            <div className="field">
              <label htmlFor="divert-km-input">Divert location KM from here</label>
              <input
                id="divert-km-input"
                type="number"
                min="0"
                value={divertKm}
                onChange={(e) => setDivertKm(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn secondary" onClick={() => setShowDivertKmModal(false)}>Cancel</button>
              <button type="submit" className="btn">Save KM</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function UnloadingDetailsSummary({ trip, onEdit }) {
  const chip = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 };
  return (
    <div className="card">
      <h3 className="section-title">Unloading Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={chip}><strong>{trip.unloadingLocation || '-'}</strong></span>
          <span style={{ ...chip, color: '#64748b' }}>{trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'}</span>
          {trip.isDiverted ? (
            <>
              <span style={chip}><span style={{ color: '#64748b' }}>Divert</span> <strong>{trip.divertUnloadingLocation || '-'}</strong></span>
              <span style={{ ...chip, color: '#64748b' }}>{trip.divertDate ? new Date(trip.divertDate).toLocaleDateString('en-IN') : '-'}</span>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

function formatMileage(km, totalDieselLitres) {
  const distance = Number(km);
  const litres = Number(totalDieselLitres);
  if (!Number.isFinite(distance) || !Number.isFinite(litres) || litres <= 0) return 'NA';
  return `${(distance / litres).toFixed(2)} km/L`;
}

function EntriesSummary({ trip, corporationKm, calculatedCorporationKm }) {
  const advances = trip.driverAdvances || [];
  const totalAdvance = advances.reduce((sum, advance) => sum + Number(advance.amount || 0), 0);
  const dieselEntries = trip.dieselEntries || [];
  const dieselCardTotal = dieselEntries
    .filter((entry) => entry.paymentMethod !== 'cash')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const dieselCashTotal = dieselEntries
    .filter((entry) => entry.paymentMethod === 'cash')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalDiesel = dieselEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalDieselLitres = trip.settlement?.totalDieselLitres != null
    ? Number(trip.settlement.totalDieselLitres)
    : null;
  const loadingExpenseTotal = Number(trip.loadingExpense || 0);
  const parkingExpenseTotal = Number(trip.parkingExpense || 0);
  const turnExpenseTotal = Number(trip.turnExpense || 0);
  const rtoEntries = trip.rtoEntries || [];
  const rtoExpenseTotal = rtoEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const otherExpenses = trip.otherExpenses || [];
  const otherExpenseTotal = otherExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalExpenses = loadingExpenseTotal + parkingExpenseTotal + turnExpenseTotal + rtoExpenseTotal + otherExpenseTotal;
  const balance = totalAdvance - (dieselCashTotal + totalExpenses);
  const manualKmRoute = trip.isDiverted && trip.divertUnloadingLocation
    ? `${trip.unloadingLocation || '-'} to ${trip.divertUnloadingLocation}`
    : `${trip.loadingLocation || '-'} to ${trip.unloadingLocation || '-'}`;

  function printTripDetails() {
    const printDate = trip.loadingDate || trip.unloadingDate || new Date();
    const date = new Date(printDate);
    const datePart = [date.getDate(), date.getMonth() + 1, date.getFullYear()]
      .map((part) => String(part).padStart(2, '0'))
      .join('-');
    const cleanPart = (value) => String(value || 'NA').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
    const filename = [
      cleanPart(trip.vehicle?.vehicleNumber),
      datePart,
      cleanPart(trip.loadingLocation),
      cleanPart(trip.unloadingLocation),
    ].join('_');
    const originalTitle = document.title;
    document.title = filename;
    window.addEventListener('afterprint', () => {
      document.title = originalTitle;
    }, { once: true });
    window.print();
  }

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 10mm 12mm 12mm 12mm;
        }

        .trip-details-print-area .summary-grid {
          padding-left: 4px;
          padding-right: 4px;
        }

        .trip-details-print-area table th,
        .trip-details-print-area table td {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
          }
          .topbar,
          .container > *:not(.trip-details-print-area) {
            display: none !important;
          }
          body * {
            visibility: hidden !important;
          }
          .trip-details-print-area, .trip-details-print-area * {
            visibility: visible !important;
          }
          .trip-details-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 6mm !important;
            border: 2px solid #1f4d2b !important;
            box-shadow: none !important;
            background: #fff !important;
            font-size: 9.5pt !important;
            line-height: 1.25 !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
          .trip-details-print-area > * {
            page-break-inside: avoid;
          }
          .trip-details-print-area .no-print {
            display: none !important;
          }
          .trip-details-print-area h3 {
            font-size: 11pt !important;
            margin: 0 !important;
            padding: 6pt 8pt !important;
            background: #f3f6f3 !important;
            border-bottom: 1px solid #1f4d2b !important;
          }
          .trip-details-print-area table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 9pt !important;
          }
          .trip-details-print-area th,
          .trip-details-print-area td {
            padding-top: 4pt !important;
            padding-bottom: 4pt !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
            vertical-align: top !important;
            color: #000 !important;
          }
          .trip-details-print-area .card-section {
            border: 1px solid #1f4d2b !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            margin-bottom: 6pt !important;
            background: #fff !important;
          }
          .trip-details-print-area .trip-km-grid > div {
            border-color: #1f4d2b !important;
          }
          .trip-details-print-area .summary-grid {
            display: block !important;
            gap: 0 !important;
            padding-left: 4px !important;
            padding-right: 4px !important;
          }
        }
      `}</style>
      <div className="card trip-details-print-area" style={{ border: '1px solid #1f4d2b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Single Trip</h3>
          <button
            type="button"
            className="btn secondary no-print"
            onClick={printTripDetails}
            aria-label="Print trip details PDF"
            title="Print / View PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            🖨️ Single Trip
          </button>
        </div>

        <div className="summary-grid" style={{ display: 'grid', gap: 16 }}>
          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <table className="trip-overview-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ width: '10%', padding: '8px 6px 8px 12px', fontWeight: 600 }}>Customer</td>
                  <td style={{ width: '40%', padding: '8px 6px' }}>{trip.customer?.companyName || 'Unknown'}</td>
                  <td style={{ width: '32%', padding: '8px 6px', fontWeight: 600, textAlign: 'right' }}>Driver</td>
                  <td style={{ width: '18%', padding: '8px 12px 8px 6px', textAlign: 'right' }}>{trip.driverName || '-'}</td>
                </tr>
                <tr>
                  <td style={{ width: '10%', padding: '8px 6px 8px 12px', fontWeight: 600 }}>Trip Route</td>
                  <td colSpan="3" style={{ width: '90%', padding: '8px 6px' }}>
                    {trip.loadingLocation || '-'} ({trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'})
                    {' \u2192 '}{trip.unloadingLocation || '-'} ({trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'})
                    {trip.isDiverted && ` \u2192 ${trip.divertUnloadingLocation || '-'} (${trip.divertDate ? new Date(trip.divertDate).toLocaleDateString('en-IN') : '-'})`}
                  </td>
                </tr>
                <tr>
                  <td colSpan="4" style={{ padding: '10px 0 8px' }}>
                    <table className="trip-km-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: 8 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid #1f4d2b' }}>Trip KM</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #1f4d2b' }}>Diesel for Trip</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #1f4d2b' }}>Mileage</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', textAlign: 'right' }}>{trip.odometerKm != null ? `${trip.odometerKm} km` : 'NA'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', textAlign: 'right' }}>{totalDieselLitres > 0 ? `${totalDieselLitres} L` : 'NA'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', textAlign: 'right' }}>{formatMileage(trip.odometerKm, totalDieselLitres)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <table className="trip-km-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid #1f4d2b' }}>KM Type</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #1f4d2b' }}>KM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [`Manual KM (${manualKmRoute})`, trip.manualKm != null && trip.manualKm !== '' ? `${trip.manualKm} km` : 'NA'],
                          ['Driver KM', calculatedCorporationKm != null ? `${calculatedCorporationKm} km` : 'NA'],
                        ].map(([label, value]) => (
                          <tr key={label}>
                            <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', fontWeight: 600 }}>{label}</td>
                            <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', textAlign: 'right' }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Driver Advance Details</h3>
            <table className="trip-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '8px 0 8px 12px' }}>Advance</th>
                </tr>
              </thead>
              <tbody>
                {advances.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ padding: '8px 0', color: '#666' }}>No driver advances added yet.</td>
                  </tr>
                ) : (
                  advances.map((advance, index) => (
                    <tr key={index}>
                      <td style={{ padding: '8px 12px 8px 0' }}>
                        {advance.date ? new Date(advance.date).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs {Number(advance.amount || 0)}</td>
                    </tr>
                  ))
                )}
                <tr style={{ borderTop: '1px solid #dfeade' }}>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}>Total</td>
                  <td style={{ fontWeight: 700, padding: '12px 0 0 0', textAlign: 'right' }}>Rs {totalAdvance}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Diesel Filled Details</h3>
            <table className="trip-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px 8px 0' }}>Purchase Type</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px 8px 0' }}>Odometer KM</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px 8px 0' }}>Tank Fill</th>
                  <th style={{ textAlign: 'right', padding: '8px 0 8px 12px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {dieselEntries.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '8px 0', color: '#666' }}>No diesel entries added yet.</td>
                  </tr>
                ) : (
                  dieselEntries.map((entry, index) => (
                    <tr key={index}>
                      <td style={{ padding: '8px 12px 8px 0' }}>
                        {entry.filledAt ? new Date(entry.filledAt).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td style={{ padding: '8px 12px 8px 0', textAlign: 'center' }}>
                        {entry.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card'}
                      </td>
                      <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>{entry.odometerKm ?? '-'}</td>
                      <td style={{ padding: '8px 12px 8px 0', textAlign: 'center' }}>{entry.loadingPointTankFill ? '✓' : '-'}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                    </tr>
                  ))
                )}
                <tr style={{ borderTop: '1px solid #dfeade' }}>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}>Diesel Card</td>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '12px 0 0 0', textAlign: 'right' }}>Rs {dieselCardTotal}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}>Cash</td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 0 0 0', textAlign: 'right' }}>Rs {dieselCashTotal}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}>Total</td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 0 0 0', textAlign: 'right' }}>Rs {totalDiesel}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Expenses</h3>
            <table className="trip-expenses-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td colSpan="4" style={{ padding: '8px 12px', fontWeight: 700, background: '#f7faf7' }}>Expenses</td>
                </tr>
                <tr>
                  <td colSpan="4" style={{ padding: 0 }}>
                    <table className="trip-detail-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '8px 12px 8px 12px' }}>Cleaner Loading</td>
                          <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {loadingExpenseTotal}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px 8px 12px' }}>Turn</td>
                          <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{trip.turnDate ? new Date(trip.turnDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {turnExpenseTotal}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px 8px 12px' }}>Parking</td>
                          <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{trip.parkingPhoto?.url ? <a href={trip.parkingPhoto.url} target="_blank" rel="noreferrer">photo</a> : '-'}</td>
                          <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {parkingExpenseTotal}</td>
                        </tr>
                        {rtoEntries.map((entry, index) => (
                          <tr key={`rto-${index}`}>
                            <td style={{ padding: '8px 12px 8px 12px' }}>RTO</td>
                            <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '-'}</td>
                            <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                          </tr>
                        ))}
                        {otherExpenses.map((entry, index) => (
                          <tr key={`other-${index}`}>
                            <td style={{ padding: '8px 12px 8px 12px' }}>{entry.description || 'Other'}</td>
                            <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '-'}</td>
                            <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1px solid #dfeade' }}>
                          <td style={{ padding: '8px 12px 8px 12px', fontWeight: 600 }}>Subtotal</td>
                          <td style={{ padding: '8px 12px 8px 0' }}> </td>
                          <td style={{ padding: '8px 12px 8px 0', fontWeight: 600, textAlign: 'right' }}>Rs {totalExpenses}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr style={{ borderTop: '1px solid #dfeade' }}>
                  <td colSpan="3" style={{ fontWeight: 700, padding: '12px 12px 0 0' }}>Total</td>
                  <td style={{ fontWeight: 700, padding: '12px 0 0 0', textAlign: 'right' }}>Rs {totalExpenses}</td>
                </tr>
                <tr>
                  <td colSpan="3" style={{ padding: '8px 12px 0 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1f2d1f' }}>Balance</span>
                      <span style={{ fontWeight: 500, color: '#4a5f52', fontSize: 11 }}>(Driver Advance - (Cash Diesel + Expenses Total))</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 0 0 0', textAlign: 'right', fontWeight: 800, fontSize: 16, color: '#1f2d1f' }}>Rs {balance}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
