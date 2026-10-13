import React, { useEffect, useState } from 'react';
import * as api from '../../api/api';

const DEFAULT_NAME = 'Shortage';

export default function ShortageRateForm({ user }) {
  const [rate, setRate] = useState(null);
  const [amountPerKg, setAmountPerKg] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      setRate(null);
      setAmountPerKg('');
      setIsEditing(false);
      return undefined;
    }

    let cancelled = false;
    api.getMeta()
      .then((res) => {
        if (cancelled) return;
        const nextRates = Array.isArray(res.data.shortageRates) ? res.data.shortageRates : [];
        setRate(nextRates[0] || null);
        if (!nextRates[0]) {
          setAmountPerKg('');
          setIsEditing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRate(null);
          setIsEditing(false);
        }
      });
    return () => { cancelled = true; };
  }, [user]);

  function resetForm() {
    setIsEditing(false);
    setAmountPerKg(rate ? String(rate.amountPerKg ?? '') : '');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const value = Number(amountPerKg);
    if (!Number.isFinite(value) || value < 0) {
      setError('Shortage Rs/Kg must be a valid positive number.');
      return;
    }

    const payload = [{ id: rate?.id || `shortage-${Date.now()}`, name: DEFAULT_NAME, amountPerKg: value }];

    setSaving(true);
    try {
      const res = await api.updateShortageRates(payload);
      const nextRate = Array.isArray(res.data.shortageRates) ? res.data.shortageRates[0] || null : payload[0];
      setRate(nextRate);
      setAmountPerKg(String(value));
      setIsEditing(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save shortage rate');
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setIsEditing(true);
    setAmountPerKg(rate ? String(rate.amountPerKg ?? '') : '');
    setError('');
  }

  function handleDelete() {
    setSaving(true);
    api.updateShortageRates([])
      .then(() => {
        setRate(null);
        setAmountPerKg('');
        setIsEditing(false);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to delete shortage rate'))
      .finally(() => setSaving(false));
  }

  if (user?.role !== 'super_admin') return null;

  return (
    <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 18px 0' }}>
        <h3 className="section-title" style={{ margin: 0 }}>Shortage Rate</h3>
      </div>

      {!rate || isEditing ? (
        <div style={{ padding: '18px', marginTop: 8 }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Shortage (Rs/Kg)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountPerKg}
                onChange={(e) => setAmountPerKg(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {isEditing && (
                <button type="button" className="btn secondary" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ padding: '0 0 0', marginTop: 8 }}>
          <div style={{ borderTop: '1px solid #2a4c64', borderBottom: '1px solid #2a4c64', background: '#dfeaf1', padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: '#0e3d4c', letterSpacing: '0.04em', fontSize: 14 }}>SHORTAGE (RS/KG)</div>
            <div style={{ fontWeight: 700, color: '#0e3d4c', letterSpacing: '0.04em', fontSize: 14, textAlign: 'right' }}>ACTION</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10, padding: '18px', borderBottom: '1px solid #2a4c64' }}>
            <div style={{ fontSize: 18, color: '#1f2d3d', fontWeight: 500 }}>Rs {Number(rate.amountPerKg || 0).toFixed(2)}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" onClick={startEdit} disabled={saving}>Edit</button>
              <button type="button" className="btn secondary" onClick={handleDelete} disabled={saving}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
