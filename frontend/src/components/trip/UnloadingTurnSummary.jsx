import React from 'react';
import * as api from '../../api/api';

export default function UnloadingTurnSummary({ trip, onDeleted }) {
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
