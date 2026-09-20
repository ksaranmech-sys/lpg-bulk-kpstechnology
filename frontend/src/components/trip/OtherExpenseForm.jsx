import React, { useState } from 'react';
import * as api from '../../api/api';
import ComboBoxInput from '../ComboBoxInput';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

const OTHER_EXPENSE_CATEGORIES = ['Unloading Cleaner', 'AdBlue', 'Puncture', 'Firegun'];

export default function OtherExpenseForm({ tripId, trip, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function submit(e) {
    e.preventDefault();
    const description = category.trim();
    if (!description) {
      setError('Select a category or enter a description.');
      return;
    }
    setError('');
    try {
      const gps = await api.getCurrentPosition();
      await api.addOtherExpense(tripId, { amount, date: date || undefined, description, lat: gps?.lat, lng: gps?.lng }, photo);
      setAmount(''); setDate(''); setCategory(''); setPhoto(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add other expense');
    }
  }

  return (
    <form onSubmit={submit} style={{ border: 0, background: 'transparent', padding: 0, borderRadius: 0 }}>
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Category</label>
          <ComboBoxInput
            value={category}
            onChange={setCategory}
            options={OTHER_EXPENSE_CATEGORIES}
            placeholder="Select or enter description"
            required
          />
        </div>
        <div className="field" style={{ margin: 0 }}><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div className="field" style={{ margin: 0 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={minDate} max={maxDate} /></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Add</button>
      </div>
    </form>
  );
}
