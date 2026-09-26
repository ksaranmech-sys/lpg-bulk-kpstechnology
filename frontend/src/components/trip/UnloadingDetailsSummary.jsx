import React from 'react';

export default function UnloadingDetailsSummary({ trip, onEdit }) {
  const chip = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 };
  return (
    <div className="card">
      <h3 className="section-title">Unloading Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={chip}><strong>{trip.unloadingLocation || '-'}</strong></span>
          {trip.unloadingWeightTons != null && trip.unloadingWeightTons !== '' && (
            <span style={chip}>
              <span style={{ color: '#64748b' }}>Weight</span> <strong>{trip.unloadingWeightTons} t</strong>
            </span>
          )}
          <span style={{ ...chip, color: '#64748b' }}>{trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'}</span>
          {trip.manualKm != null && trip.manualKm !== '' && (
            <span style={chip}>
              <span style={{ color: '#64748b' }}>Manual KM Load</span> <strong>{trip.manualKm} km</strong>
            </span>
          )}
          {trip.isDiverted ? (
            <>
              <span style={chip}><span style={{ color: '#64748b' }}>Divert</span> <strong>{trip.divertUnloadingLocation || '-'}</strong></span>
              <span style={{ ...chip, color: '#64748b' }}>{trip.divertDate ? new Date(trip.divertDate).toLocaleDateString('en-IN') : '-'}</span>
            </>
          ) : null}
          {trip.isDiverted && trip.manualKmDivert != null && trip.manualKmDivert !== '' && (
            <span style={chip}>
              <span style={{ color: '#64748b' }}>Manual KM Divert</span> <strong>{trip.manualKmDivert} km</strong>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}
