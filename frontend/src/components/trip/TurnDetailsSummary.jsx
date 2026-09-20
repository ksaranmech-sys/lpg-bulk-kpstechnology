import React from 'react';

export default function TurnDetailsSummary({ trip, onEdit }) {
  const chip = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 };
  return (
    <div className="card">
      <h3 className="section-title">Load Turn Added</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={chip}><span style={{ color: '#64748b' }}>Turn</span> <strong>{trip.turnNumber}</strong></span>
          <span style={{ ...chip, color: '#64748b' }}>{new Date(trip.turnDate).toLocaleDateString('en-IN')}</span>
          {trip.fillingOrderLocation && (
            <span style={chip}><span style={{ color: '#64748b' }}>Filling order</span> <strong>{trip.fillingOrderLocation}</strong></span>
          )}
          {trip.manualKmReturn != null && trip.manualKmReturn !== '' && (
            <span style={chip}>
              <span style={{ color: '#64748b' }}>Manual KM Return</span> <strong>{trip.manualKmReturn} km</strong>
            </span>
          )}
        </div>
        <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}
