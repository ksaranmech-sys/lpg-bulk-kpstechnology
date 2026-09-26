import React, { useEffect, useMemo, useState } from 'react';
import { VEHICLE_EXPENSE_CATEGORIES, currentMonth, formatMonthLabel, monthKey } from '@kps/shared';
import * as api from '../../api/api';
import ComboBoxInput from '../../components/ComboBoxInput';

const EMPTY_FORM = { category: '', amount: '', date: '', note: '' };
const cell = { padding: '8px 12px' };

function formatRs(value) {
  return `Rs ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

function toInputDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

// Add / edit / delete running costs for this driver's vehicle; the dashboard only shows totals.
export default function DriverVehicleExpenses({ customerId, vehicle, setError }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selected, setSelected] = useState([]);
  const [editId, setEditId] = useState('');
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveMonth, setArchiveMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!customerId || !vehicle?._id) return;
    setLoading(true);
    api.listVehicleExpenses({ customerId })
      .then((res) => setExpenses((res.data.expenses || []).filter((expense) => (
        String(expense.vehicle?._id || expense.vehicle) === String(vehicle._id)
      ))))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load vehicle expenses'))
      .finally(() => setLoading(false));
  }, [customerId, vehicle?._id, setError]);

  const thisMonth = currentMonth();
  // Current month stays on the main list; everything older is archived by month.
  const currentEntries = expenses.filter((expense) => monthKey(expense.date) === thisMonth);
  const archivedEntries = expenses.filter((expense) => monthKey(expense.date) !== thisMonth);
  const archivedMonths = useMemo(() => (
    Array.from(new Set(archivedEntries.map((expense) => monthKey(expense.date)).filter(Boolean))).sort().reverse()
  ), [archivedEntries]);
  const archiveKey = archiveMonth || archivedMonths[0] || '';
  const visibleEntries = showArchived ? archivedEntries.filter((expense) => monthKey(expense.date) === archiveKey) : currentEntries;
  const visibleTotal = visibleEntries.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

  const years = useMemo(() => {
    const set = new Set(expenses.map((expense) => new Date(expense.date).getFullYear()).filter(Number.isFinite));
    set.add(new Date().getFullYear());
    return Array.from(set).sort().reverse();
  }, [expenses]);
  const yearTotal = expenses
    .filter((expense) => new Date(expense.date).getFullYear() === Number(year))
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

  async function addExpense(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.createVehicleExpense({ ...form, vehicleId: vehicle._id, amount: Number(form.amount) });
      setExpenses((current) => [res.data.expense, ...current]);
      setForm(EMPTY_FORM);
      setShowAddForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add vehicle expense');
    } finally {
      setSaving(false);
    }
  }

  function editSelected() {
    if (selected.length !== 1) return;
    const expense = expenses.find((entry) => entry._id === selected[0]);
    if (!expense) return;
    setEditId(expense._id);
    setEditForm({
      category: expense.category || '',
      amount: String(expense.amount ?? ''),
      date: toInputDate(expense.date),
      note: expense.note || '',
    });
    setError('');
  }

  function cancelEdit() {
    setEditId('');
    setEditForm(EMPTY_FORM);
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editId) return;
    setError('');
    setEditSaving(true);
    try {
      const res = await api.updateVehicleExpense(editId, { ...editForm, amount: Number(editForm.amount) });
      setExpenses((current) => current.map((expense) => (expense._id === editId ? res.data.expense : expense)));
      cancelEdit();
      setSelected([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update vehicle expense');
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteSelected() {
    if (selected.length !== 1) return;
    if (!window.confirm('Delete this vehicle expense?')) return;
    setError('');
    try {
      await api.deleteVehicleExpense(selected[0]);
      setExpenses((current) => current.filter((expense) => expense._id !== selected[0]));
      setSelected([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete vehicle expense');
    }
  }

  function renderFields(state, setState) {
    return (
      <>
        <div className="grid-2">
          <div className="field">
            <label>Expense Type</label>
            <ComboBoxInput
              value={state.category}
              onChange={(value) => setState({ ...state, category: value })}
              options={VEHICLE_EXPENSE_CATEGORIES}
              placeholder="Select or enter expense type"
              required
            />
          </div>
          <div className="field">
            <label>Amount (Rs)</label>
            <input type="number" min="0" step="0.01" value={state.amount} onChange={(e) => setState({ ...state, amount: e.target.value })} required />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Date</label>
            <input type="date" value={state.date} onChange={(e) => setState({ ...state, date: e.target.value })} required />
          </div>
          <div className="field">
            <label>Note (optional)</label>
            <input value={state.note} onChange={(e) => setState({ ...state, note: e.target.value })} />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Vehicle Expenses {vehicle.vehicleNumber} ({formatMonthLabel(showArchived && archiveKey ? archiveKey : thisMonth)})
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }} aria-label="Expense year">
            {years.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <span style={{ fontWeight: 700 }}>Total {year}: {formatRs(yearTotal)}</span>
        </div>
      </div>
      {loading ? <p>Loading vehicle expenses...</p> : visibleEntries.length === 0 ? (
        <p>{showArchived ? 'No archived vehicle expenses.' : 'No vehicle expenses this month.'}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center', ...cell }}>Select</th>
                <th style={{ textAlign: 'left', ...cell }}>Date</th>
                <th style={{ textAlign: 'left', ...cell }}>Expense Type</th>
                <th style={{ textAlign: 'right', ...cell }}>Amount</th>
                <th style={{ textAlign: 'left', ...cell }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((expense) => (
                <tr key={expense._id}>
                  {editId === expense._id ? (
                    <td colSpan={5} style={cell}>
                      <form onSubmit={saveEdit}>
                        {renderFields(editForm, setEditForm)}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" disabled={editSaving} type="submit">{editSaving ? 'Saving...' : 'Save'}</button>
                          <button type="button" className="btn secondary" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td style={{ ...cell, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selected.includes(expense._id)}
                          onChange={() => setSelected((current) => (
                            current.includes(expense._id) ? current.filter((id) => id !== expense._id) : [...current, expense._id]
                          ))}
                          aria-label="Select vehicle expense"
                          style={{ width: 'auto' }}
                        />
                      </td>
                      <td style={cell}>{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                      <td style={cell}>{expense.category}</td>
                      <td style={{ ...cell, textAlign: 'right' }}>{formatRs(expense.amount)}</td>
                      <td style={cell}>{expense.note || '-'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>Month Total</td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{formatRs(visibleTotal)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={3} style={{ ...cell, textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border)' }}>Yearly Total {year}</td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border)' }}>{formatRs(yearTotal)}</td>
                <td style={{ borderTop: '1px solid var(--border)' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="btn" onClick={() => setShowAddForm((current) => !current)}>
          {showAddForm ? 'Close Add' : 'Add'}
        </button>
        <button type="button" className="btn secondary" disabled={selected.length !== 1} onClick={editSelected}>Edit</button>
        <button type="button" className="btn danger" disabled={selected.length !== 1} onClick={deleteSelected}>Delete</button>
      </div>
      {showAddForm && (
        <form onSubmit={addExpense} style={{ marginTop: 20 }}>
          <h4 style={{ marginTop: 0 }}>Add Vehicle Expense</h4>
          {renderFields(form, setForm)}
          <button className="btn" disabled={saving} type="submit">{saving ? 'Saving...' : 'Add Expense'}</button>
        </form>
      )}
      <div className="salary-archive-footer">
        <button
          type="button"
          className="salary-archive-link"
          onClick={() => { setShowArchived((current) => !current); setSelected([]); cancelEdit(); }}
        >
          {showArchived ? 'Back to current month' : `View archived expenses (${archivedEntries.length})`}
        </button>
        {showArchived && archivedMonths.length > 0 && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="driver-vehicle-expense-month">Archived Month</label>
            <select id="driver-vehicle-expense-month" value={archiveKey} onChange={(e) => setArchiveMonth(e.target.value)}>
              {archivedMonths.map((key) => <option key={key} value={key}>{formatMonthLabel(key)}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
