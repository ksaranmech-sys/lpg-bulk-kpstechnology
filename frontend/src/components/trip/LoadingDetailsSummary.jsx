import React from 'react';

export default function LoadingDetailsSummary({ trip, onEdit }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
          <strong>{trip.loadingLocation || '-'}</strong>
        </span>
        <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14, color: '#64748b' }}>
          {trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}
        </span>
        <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
          <span style={{ color: '#64748b' }}>Cleaner</span> <strong>Rs {trip.loadingExpense || 0}</strong>
        </span>
        <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
          <span style={{ color: '#64748b' }}>Turn</span> <strong>Rs {trip.turnExpense || 0}</strong>
        </span>
        <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}>
          <span style={{ color: '#64748b' }}>Parking</span> <strong>Rs {trip.parkingExpense || 0}</strong>
        </span>
        {trip.parkingPhoto?.url && (
          <a href={trip.parkingPhoto.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef7f4', border: '1px solid #bfe3da', borderRadius: 8, padding: '6px 12px', fontSize: 14, textDecoration: 'none' }}>
            <img src={trip.parkingPhoto.url} alt="Parking" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 6 }} />
            <span>Photo</span>
          </a>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn secondary" onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}
