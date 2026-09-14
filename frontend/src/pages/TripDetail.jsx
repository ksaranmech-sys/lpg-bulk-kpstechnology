import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';

export default function TripDetail() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [meta, setMeta] = useState({ loadingLocations: [], unloadingLocations: [], routeKmTable: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingLoadingDetails, setEditingLoadingDetails] = useState(false);
  const [editingUnloadingDetails, setEditingUnloadingDetails] = useState(false);
  const [editingUnloadingExpense, setEditingUnloadingExpense] = useState(false);
  const [editingTurnDetails, setEditingTurnDetails] = useState(false);

  function load() {
    api.getTrip(tripId).then((res) => setTrip(res.data.trip));
    api.getMeta().then((res) => setMeta(res.data));
  }
  useEffect(load, [tripId]);

  if (!trip) return <Layout><p>Loading...</p></Layout>;

  const isClosed = trip.status === 'closed';
  const hasLoadingDetails = Boolean(trip.loadingLocation && trip.loadingDate);
  const hasLoadingExpense = Number(trip.loadingExpense) > 0;
  const hasUnloadingDetails = Boolean(trip.unloadingLocation && trip.unloadingDate);
  const hasUnloadingExpense = Number(trip.unloadingExpense) > 0;
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
        </h2>
        <span className={`badge ${trip.status}`}>{trip.status}</span>
      </div>
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <p style={{ color: '#666', margin: 0 }}>
          Customer: {trip.customer?.companyName || 'Unknown'}
        </p>
      </div>

      {message && <div className="card" style={{ background: '#fff8e1' }}>{message}</div>}

      <fieldset disabled={isClosed} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {isClosed && trip.settlement?.calculatedAt && (
          <SettlementCard trip={trip} onSend={async () => {
            setBusy(true);
            setMessage('');
            try {
              await api.sendReport(tripId);
              setMessage('Report emailed to company (and customer) successfully.');
            } catch (err) {
              setMessage(err.response?.data?.error || 'Failed to send report');
            } finally {
              setBusy(false);
            }
          }} busy={busy} />
        )}

        <>
        {(trip.driverAdvances || []).length > 0 && (
          <div className="card">
            <AdvanceSummary trip={trip} onSaved={load} />
            <div style={{ marginTop: 16 }}>
              <AdvanceForm tripId={tripId} onSaved={load} />
            </div>
          </div>
        )}
        {!(trip.driverAdvances || []).length && (
          <div className="card">
            <AdvanceForm tripId={tripId} onSaved={load} />
          </div>
        )}
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
          <DieselForm tripId={tripId} onSaved={load} />
        </div>
        <div className="card">
          <RtoSummary trip={trip} onSaved={load} />
          <RtoForm tripId={tripId} onSaved={load} />
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
        {hasUnloadingExpense && <UnloadingExpenseSummary trip={trip} onEdit={() => setEditingUnloadingExpense(true)} />}
        {(!hasUnloadingExpense || editingUnloadingExpense) && (
          <UnloadingExpenseForm
            tripId={tripId}
            trip={trip}
            onSaved={() => { setEditingUnloadingExpense(false); load(); }}
          />
        )}
        {hasTurnDetails && <TurnDetailsSummary trip={trip} onEdit={() => setEditingTurnDetails(true)} />}
        {(!hasTurnDetails || editingTurnDetails) && (
          <TurnDetailsForm
            tripId={tripId}
            trip={trip}
            onSaved={() => { setEditingTurnDetails(false); load(); }}
          />
        )}
        <div className="card">
          <OtherExpenseSummary trip={trip} tripId={tripId} onSaved={load} />
          <OtherExpenseForm tripId={tripId} onSaved={load} />
        </div>
        <div className="card">
          <div style={{ display: 'grid', gap: 16 }}>
            <TripClosingDieselSummary trip={trip} tripId={tripId} onSaved={load} />
            {!isClosed && (
              <div style={{ borderTop: '1px solid #e6efe7', paddingTop: 12 }}>
                <DieselForm
                  tripId={tripId}
                  onSaved={async () => {
                    setBusy(true);
                    setMessage('');
                    try {
                      await api.closeTrip(tripId);
                      await load();
                      setMessage('Trip closed successfully.');
                    } catch (err) {
                      setMessage(err.response?.data?.error || 'Failed to close trip');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  title="Total Closing Diesel Value"
                  submitLabel="Submit"
                  closeAfterSave
                />
              </div>
            )}
          </div>
        </div>
        </>

        <EntriesSummary
          trip={trip}
          corporationKm={(meta.routeKmTable || []).find((row) => (
            String(row.loadingLocation || '').trim() === String(trip.loadingLocation || '').trim() &&
            String(row.unloadingLocation || '').trim() === String(trip.unloadingLocation || '').trim()
          ))?.km}
        />
      </fieldset>
    </Layout>
  );
}

function SettlementCard({ trip, onSend, busy }) {
  const s = trip.settlement;
  return (
    <div>
      <h3 className="section-title">Settlement Summary</h3>
      <table>
        <tbody>
          <tr><td>Total Diesel</td><td>{s.totalDieselLitres} L (Rs {s.totalDieselCost})</td></tr>
          <tr><td>Total KM Run</td><td>{s.totalKm} km</td></tr>
          <tr><td>Mileage</td><td>{s.mileageKmPerLitre ?? '-'} km/L</td></tr>
          <tr><td>Total Expense (excl. diesel)</td><td>Rs {s.totalExpense}</td></tr>
          <tr><td>Total Advance</td><td>Rs {s.totalAdvance}</td></tr>
          <tr><td><strong>Balance</strong></td><td><strong>Rs {s.balance}</strong></td></tr>
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <a className="btn secondary" href={api.reportDownloadUrl(trip._id)} target="_blank" rel="noreferrer">
          Print / View PDF
        </a>
        <button className="btn" onClick={onSend} disabled={busy}>
          {busy ? 'Sending...' : 'Email Report to Company'}
        </button>
      </div>
    </div>
  );
}

function AdvanceForm({ tripId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  async function submit(e) {
    e.preventDefault();
    await api.addAdvance(tripId, { amount: Number(amount), date: date || undefined });
    setAmount(''); setDate('');
    onSaved();
  }
  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Add Driver Advance</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
        <div className="field"><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <button className="btn">Add Advance</button>
      </div>
    </form>
  );
}

function AdvanceSummary({ trip, onSaved }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  function startEdit(index, advance) {
    setEditingIndex(index);
    setAmount(String(advance.amount));
    setDate(new Date(advance.date).toISOString().slice(0, 10));
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateAdvance(trip._id, index, { amount: Number(amount), date });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update advance');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Driver Advances Added</h3>
      {error && <div className="error-text">{error}</div>}
      {(trip.driverAdvances || []).length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No advances added yet.</p>
      ) : (
        <table>
          <thead><tr><th>Amount</th><th style={{ textAlign: 'center' }}>Date</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {trip.driverAdvances.map((advance, i) => (
              <tr key={i}>
                {editingIndex === i ? (
                  <>
                    <td><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" /></td>
                    <td style={{ textAlign: 'center' }}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></td>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Loading Location</label>
          <select value={loadingLocation} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Select from KM table...</option>
            {loadingOptions.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Enter Loading Location Manually</label>
          <input
            value={loadingLocation}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter loading location"
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginTop: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Date of loading</label>
          <input type="date" value={loadingDate} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <button className="btn" style={{ marginBottom: 0 }}>Save loading details</button>
      </div>
    </form>
  );
}

function LoadingDetailsSummary({ trip, onEdit }) {
  return (
    <div className="card">
      <h3 className="section-title">Loading Details Added</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <p style={{ margin: 0 }}>
          {trip.loadingLocation || '-'} • {trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

function LoadingExpenseForm({ tripId, trip, onSaved }) {
  const [amount, setAmount] = useState(trip.loadingExpense || '');

  async function submit(e) {
    e.preventDefault();
    await api.setLoadingDetails(tripId, { loadingExpense: Number(amount || 0) });
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Loading Expenses</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Cleaner Expense (Rs)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button className="btn" style={{ marginBottom: 0 }}>Save Loading Expense</button>
      </div>
    </form>
  );
}

function LoadingExpenseSummary({ trip, tripId, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(trip.loadingExpense || ''));
  const [error, setError] = useState('');

  async function saveEdit() {
    setError('');
    try {
      await api.setLoadingDetails(tripId, { loadingExpense: Number(amount || 0) });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update loading expense');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Loading Expenses Added</h3>
      {error && <div className="error-text">{error}</div>}
      {editing ? (
        <div className="field">
          <label>Cleaner Expense (Rs)</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={saveEdit}>Save</button>{' '}
            <button type="button" className="btn secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
          <p style={{ margin: 0 }}>Cleaner: Rs {trip.loadingExpense || 0}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn secondary" onClick={() => setEditing(true)}>Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TurnDetailsForm({ tripId, trip, onSaved }) {
  const [turnNumber, setTurnNumber] = useState(trip.turnNumber != null ? String(trip.turnNumber) : '');
  const [turnDate, setTurnDate] = useState(trip.turnDate ? new Date(trip.turnDate).toISOString().slice(0, 10) : '');

  async function submit(e) {
    e.preventDefault();
    await api.setTurnDetails(tripId, { turnNumber: Number(turnNumber), turnDate });
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">L Turn</h3>
      <div className="grid-2">
        <div className="field">
          <label>Turn Number</label>
          <input type="number" min="0" step="1" value={turnNumber} onChange={(e) => setTurnNumber(e.target.value)} required />
        </div>
        <div className="field">
          <label>Turn Date</label>
          <input type="date" value={turnDate} onChange={(e) => setTurnDate(e.target.value)} required />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn">Save Turn Details</button>
      </div>
    </form>
  );
}

function TurnDetailsSummary({ trip, onEdit }) {
  return (
    <div className="card">
      <h3 className="section-title">L Turn Added</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <p style={{ margin: 0 }}>
          Turn {trip.turnNumber} • {new Date(trip.turnDate).toLocaleDateString('en-IN')}
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
      <h3 className="section-title">UN Turn</h3>
      <div className="grid-2">
        <div className="field">
          <label>Turn Number</label>
          <input type="number" min="0" step="1" value={turnNumber} onChange={(e) => setTurnNumber(e.target.value)} required />
        </div>
        <div className="field">
          <label>Turn Date</label>
          <input type="date" value={turnDate} onChange={(e) => setTurnDate(e.target.value)} required />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn">Add UN Turn</button>
      </div>
    </form>
  );
}

function UnloadingTurnSummary({ trip, onDeleted }) {
  async function deleteTurn() {
    if (!window.confirm('Delete this UN Turn?')) return;
    await api.deleteUnloadingTurnDetails(trip._id);
    onDeleted();
  }

  return (
    <div className="card">
      <h3 className="section-title">UN Turn Added</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <p style={{ margin: 0 }}>
          Turn {trip.unTurnNumber} • {new Date(trip.unTurnDate).toLocaleDateString('en-IN')}
        </p>
        <button type="button" className="btn danger" onClick={deleteTurn}>Delete</button>
      </div>
    </div>
  );
}

function DieselForm({
  tripId,
  onSaved,
  title = 'Diesel Filling Entry',
  submitLabel = 'Add Diesel Entry',
  closeAfterSave = false,
}) {
  const [volumeLitres, setVolume] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('diesel_card');
  const [odometerKm, setOdo] = useState('');
  const [filledAt, setFilledAt] = useState('');
  const [photo, setPhoto] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const gps = await api.getCurrentPosition();
    await api.addDieselEntry(
      tripId,
      { volumeLitres, totalValue, paymentMethod, odometerKm: odometerKm || undefined, filledAt: filledAt || undefined, lat: gps?.lat, lng: gps?.lng },
      photo
    );
    setVolume(''); setTotalValue(''); setPaymentMethod('diesel_card'); setOdo(''); setFilledAt(''); setPhoto(null);
    if (closeAfterSave) {
      await onSaved();
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} style={{ padding: '0', margin: 0 }}>
      <h3 className="section-title">{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <div className="field"><label>Volume (Litres)</label><input type="number" value={volumeLitres} onChange={(e) => setVolume(e.target.value)} required /></div>
        <div className="field"><label>Total Value (Rs)</label><input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} required /></div>
        <div className="field">
          <label>Payment Method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="diesel_card">Diesel Card</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div className="field"><label>Odometer Reading</label><input type="number" value={odometerKm} onChange={(e) => setOdo(e.target.value)} placeholder="Optional" /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Date</label>
          <input type="date" value={filledAt} onChange={(e) => setFilledAt(e.target.value)} required />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginTop: 12 }}>
        <div className="field">
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn" type="submit">{submitLabel}</button>
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
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  function startEdit(index, entry) {
    setEditingIndex(index);
    setVolume(String(entry.volumeLitres));
    setTotalValue(String(entry.amount));
    setPaymentMethod(entry.paymentMethod || 'diesel_card');
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
      <h3 className="section-title">Diesel Filled Added</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No diesel fills added yet.</p>
      ) : (
        <table>
          <thead><tr><th>Volume (L)</th><th>Total Value</th><th>Date</th><th>Payment</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} min="0" /></td>
                    <td><input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} min="0" /></td>
                    <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="diesel_card">Diesel Card</option>
                        <option value="cash">Cash</option>
                      </select>
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
                    <td>{new Date(entry.filledAt).toLocaleDateString('en-IN')}</td>
                    <td>{entry.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card'}</td>
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
      <h3 className="section-title">RTO Expenses Added</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No RTO expenses added yet.</p>
      ) : (
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
    <form onSubmit={submit}>
      <h3 className="section-title">RTO Entry</h3>
      <div className="grid-2">
        <div className="field"><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
        <div className="field">
          <label>Photo (with GPS location captured automatically)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn">Add RTO Entry</button>
      </div>
    </form>
  );
}

function OtherExpenseForm({ tripId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const gps = await api.getCurrentPosition();
    await api.addOtherExpense(tripId, { amount, date: date || undefined, description, lat: gps?.lat, lng: gps?.lng }, photo);
    setAmount(''); setDate(''); setDescription(''); setPhoto(null);
    onSaved();
  }

  return (
    <form onSubmit={submit}>
      <h3 className="section-title">Other Expense</h3>
      <div className="grid-2">
        <div className="field"><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="field"><label>Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
        <div className="field">
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn">Add Expense</button>
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
      <h3 className="section-title">Other Expenses Added</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No other expenses added yet.</p>
      ) : (
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Photo</th><th>Actions</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></td>
                    <td><input value={description} onChange={(e) => setDescription(e.target.value)} /></td>
                    <td><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></td>
                    <td>{entry.photo?.url ? <a href={entry.photo.url} target="_blank" rel="noreferrer">view</a> : '-'}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => saveEdit(index)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                    <td>{entry.description || '-'}</td>
                    <td>Rs {entry.amount}</td>
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

function TripClosingDieselSummary({ trip, tripId, onSaved }) {
  const entries = trip.dieselEntries || [];
  const closingIndex = entries.length - 1;
  const closingEntry = entries[closingIndex];
  const [editing, setEditing] = useState(false);
  const [volume, setVolume] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('diesel_card');
  const [tripKm, setTripKm] = useState('');
  const [error, setError] = useState('');

  async function saveEdit() {
    setError('');
    try {
      await api.updateDieselEntry(tripId, closingIndex, {
        volumeLitres: Number(volume),
        totalValue: Number(totalValue),
        paymentMethod,
        odometerKm: tripKm === '' ? undefined : Number(tripKm),
      });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update closing diesel');
    }
  }

  if (!closingEntry) {
    return (
      <div>
        <h3 className="section-title">Total Closing Diesel Value</h3>
        <p style={{ margin: 0, color: '#666' }}>No closing diesel value entered yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="section-title">Total Closing Diesel Value</h3>
      {error && <div className="error-text">{error}</div>}
      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div className="field">
            <label>Volume (L)</label>
            <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} min="0" />
          </div>
          <div className="field">
            <label>Value (Rs)</label>
            <input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} min="0" />
          </div>
          <div className="field">
            <label>Odometer Reading</label>
            <input type="number" value={tripKm} onChange={(e) => setTripKm(e.target.value)} min="0" placeholder="Optional" />
          </div>
          <div className="field">
            <label>Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="diesel_card">Diesel Card</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={saveEdit}>Submit for Close Trip</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
          {[
            { label: 'Volume', value: `${closingEntry.volumeLitres} L` },
            { label: 'Value', value: `Rs ${closingEntry.amount}` },
            { label: 'Trip KM', value: closingEntry.odometerKm != null ? `${closingEntry.odometerKm} km` : '-' },
            { label: 'Date', value: closingEntry.filledAt ? new Date(closingEntry.filledAt).toLocaleDateString('en-IN') : '-' },
            { label: 'Payment', value: closingEntry.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card' },
          ].map((item) => (
            <div key={item.label} style={{
              background: '#f7faf7',
              border: '1px solid #dfeade',
              borderRadius: 10,
              padding: '12px 14px',
              minHeight: 84,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <small style={{ display: 'block', color: '#4a5f52', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</small>
              <strong style={{ fontSize: 15, color: '#1f2d1f', lineHeight: 1.4 }}>{item.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UnloadingForm({ tripId, meta, trip, routeUnloadingOptions, onSaved }) {
  const [unloadingLocation, setLoc] = useState(trip.unloadingLocation || '');
  const [unloadingDate, setDate] = useState(trip.unloadingDate ? new Date(trip.unloadingDate).toISOString().slice(0, 10) : '');
  const [manualKm, setManualKm] = useState(trip.manualKm != null ? String(trip.manualKm) : '');
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
    await api.setUnloading(tripId, {
      unloadingLocation,
      unloadingDate,
      manualKm: manualKm === '' ? undefined : Number(manualKm),
    });
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Unloading Details</h3>
      <div className="grid-2">
        <div className="field">
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
        <div className="field">
          <label>Unloading Location</label>
          <select
            value={unloadingLocation}
            onChange={(e) => setLoc(e.target.value)}
          >
            <option value="">Select...</option>
            {(filteredUnloadingOptions || []).filter(Boolean).map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Or Enter Unloading Location Manually</label>
        <input
          value={unloadingLocation}
          onChange={(e) => setLoc(e.target.value)}
          placeholder="Enter unloading location"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end', marginTop: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Unloading Date</label>
          <input type="date" value={unloadingDate} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Manual KM</label>
          <input
            type="number"
            min="0"
            value={manualKm}
            onChange={(e) => setManualKm(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginTop: 12 }}>
        <div />
        <button className="btn" style={{ marginBottom: 0 }}>Save Unloading Details</button>
      </div>
      <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
        Note: this trip will automatically close and settle once diesel is filled again for the
        next trip at the loading location.
      </p>
    </form>
  );
}

function UnloadingDetailsSummary({ trip, onEdit }) {
  return (
    <div className="card">
      <h3 className="section-title">Unloading Details Added</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <p style={{ margin: 0 }}>
          {trip.unloadingLocation || '-'} • {trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'}
          {trip.manualKm != null && trip.manualKm !== '' ? ` • Manual KM: ${trip.manualKm}` : ''}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

function UnloadingExpenseForm({ tripId, trip, onSaved }) {
  const [amount, setAmount] = useState(trip.unloadingExpense || '');

  async function submit(e) {
    e.preventDefault();
    await api.setUnloading(tripId, {
      unloadingDate: trip.unloadingDate,
      unloadingExpense: Number(amount || 0),
    });
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Unloading Expenses</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
        <div className="field">
          <label>Unloading Expense - Cleaner (Rs)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button className="btn">Save Unloading Expense</button>
      </div>
    </form>
  );
}

function UnloadingExpenseSummary({ trip, onEdit }) {
  return (
    <div className="card">
      <h3 className="section-title">Unloading Expenses Added</h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0 }}>Cleaner: Rs {trip.unloadingExpense || 0}</p>
        <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
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

function EntriesSummary({ trip, corporationKm }) {
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
  const totalDieselLitres = dieselEntries.reduce((sum, entry) => sum + Number(entry.volumeLitres || 0), 0);
  const loadingExpenseTotal = Number(trip.loadingExpense || 0);
  const rtoEntries = trip.rtoEntries || [];
  const rtoExpenseTotal = rtoEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const unloadingExpenseTotal = Number(trip.unloadingExpense || 0);
  const otherExpenses = trip.otherExpenses || [];
  const otherExpenseTotal = otherExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalExpenses = loadingExpenseTotal + rtoExpenseTotal + unloadingExpenseTotal + otherExpenseTotal;
  const balance = totalAdvance - (dieselCashTotal + totalExpenses);

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 10mm 12mm 12mm 12mm;
        }

        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
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
            font-size: 9pt !important;
          }
          .trip-details-print-area th,
          .trip-details-print-area td {
            padding-top: 4pt !important;
            padding-bottom: 4pt !important;
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
          }
        }
      `}</style>
      <div className="card trip-details-print-area" style={{ border: '1px solid #1f4d2b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Trip details</h3>
          <button
            type="button"
            className="btn secondary no-print"
            onClick={() => window.print()}
            aria-label="Print trip details PDF"
            title="Print / View PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            🖨️ Print
          </button>
        </div>

        <div className="summary-grid" style={{ display: 'grid', gap: 16 }}>
          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Trip Details</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '25%', padding: '8px 12px 8px 0', fontWeight: 600 }}>Customer</td>
                  <td colSpan="3" style={{ width: '75%', padding: '8px 0' }}>{trip.customer?.companyName || 'Unknown'}</td>
                </tr>
                <tr>
                  <td style={{ width: '25%', padding: '8px 12px 8px 0', fontWeight: 600 }}>Loading Location</td>
                  <td style={{ width: '25%', padding: '8px 12px 8px 0' }}>{trip.loadingLocation || '-'}</td>
                  <td style={{ width: '25%', padding: '8px 12px 8px 0', fontWeight: 600 }}>Loading Date</td>
                  <td style={{ width: '25%', padding: '8px 0' }}>{trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}</td>
                </tr>
                <tr>
                  <td style={{ width: '25%', padding: '8px 12px 8px 0', fontWeight: 600 }}>Unloading Location</td>
                  <td style={{ width: '25%', padding: '8px 12px 8px 0' }}>{trip.unloadingLocation || '-'}</td>
                  <td style={{ width: '25%', padding: '8px 12px 8px 0', fontWeight: 600 }}>Unloading Date</td>
                  <td style={{ width: '25%', padding: '8px 0' }}>{trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'}</td>
                </tr>
                <tr>
                  <td colSpan="4" style={{ padding: '10px 0 8px' }}>
                    <div className="trip-km-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                      {[
                        { label: 'Odometer KM', value: trip.odometerKm != null ? `${trip.odometerKm} km` : 'NA', mileage: formatMileage(trip.odometerKm, totalDieselLitres) },
                        { label: 'Corp. KM', value: corporationKm != null ? `${corporationKm} km` : 'NA', mileage: formatMileage(corporationKm, totalDieselLitres) },
                        { label: 'Manual KM', value: trip.manualKm != null && trip.manualKm !== '' ? `${trip.manualKm} km` : 'NA', mileage: formatMileage(trip.manualKm, totalDieselLitres) },
                      ].map((item) => (
                        <div key={item.label} style={{ minWidth: 0, padding: '8px 10px', border: '1px solid #1f4d2b', borderRadius: 6, textAlign: 'center' }}>
                          <strong style={{ display: 'block', marginBottom: 4 }}>{item.label}</strong>
                          <div>{item.value}</div>
                          <small>Mil.: {item.mileage}</small>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Driver Advance Details</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px 8px 0' }}>Purchase Type</th>
                  <th style={{ textAlign: 'right', padding: '8px 0 8px 12px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {dieselEntries.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '8px 0', color: '#666' }}>No diesel entries added yet.</td>
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
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                    </tr>
                  ))
                )}
                <tr style={{ borderTop: '1px solid #dfeade' }}>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}>Diesel Card</td>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '12px 0 0 0', textAlign: 'right' }}>Rs {dieselCardTotal}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}>Cash</td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 0 0 0', textAlign: 'right' }}>Rs {dieselCashTotal}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}>Total</td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 0 0 0', textAlign: 'right' }}>Rs {totalDiesel}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Expenses</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td colSpan="2" style={{ padding: '8px 12px', fontWeight: 700, background: '#f7faf7' }}>Loading Expenses</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px 8px 0' }}>{trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs {loadingExpenseTotal}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>Subtotal</td>
                  <td style={{ padding: '8px 0', fontWeight: 600, textAlign: 'right' }}>Rs {loadingExpenseTotal}</td>
                </tr>

                <tr>
                  <td colSpan="2" style={{ padding: '8px 12px', fontWeight: 700, background: '#f7faf7' }}>RTO Expenses</td>
                </tr>
                {rtoEntries.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ padding: '8px 12px', color: '#666' }}>No RTO entries added.</td>
                  </tr>
                ) : (
                  rtoEntries.map((entry, index) => (
                    <tr key={index}>
                      <td style={{ padding: '8px 12px 8px 0' }}>{entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '-'}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                    </tr>
                  ))
                )}
                <tr>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>Subtotal</td>
                  <td style={{ padding: '8px 0', fontWeight: 600, textAlign: 'right' }}>Rs {rtoExpenseTotal}</td>
                </tr>

                <tr>
                  <td colSpan="2" style={{ padding: '8px 12px', fontWeight: 700, background: '#f7faf7' }}>Unloading Expenses</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px 8px 0' }}>{trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs {unloadingExpenseTotal}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>Subtotal</td>
                  <td style={{ padding: '8px 0', fontWeight: 600, textAlign: 'right' }}>Rs {unloadingExpenseTotal}</td>
                </tr>

                <tr>
                  <td colSpan="2" style={{ padding: '8px 12px', fontWeight: 700, background: '#f7faf7' }}>Other Expenses</td>
                </tr>
                {otherExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ padding: '8px 12px', color: '#666' }}>No other expenses added.</td>
                  </tr>
                ) : (
                  otherExpenses.map((entry, index) => (
                    <tr key={index}>
                      <td style={{ padding: '8px 12px 8px 0' }}>{entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '-'}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                    </tr>
                  ))
                )}
                <tr>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>Subtotal</td>
                  <td style={{ padding: '8px 0', fontWeight: 600, textAlign: 'right' }}>Rs {otherExpenseTotal}</td>
                </tr>

                <tr style={{ borderTop: '1px solid #dfeade' }}>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}>Total</td>
                  <td style={{ fontWeight: 700, padding: '12px 0 0 0', textAlign: 'right' }}>Rs {totalExpenses}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px 0 0' }}>
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
