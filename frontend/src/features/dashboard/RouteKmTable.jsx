import React, { useEffect, useState } from 'react';
import * as api from '../../api/api';

export default function RouteKmTable({ user }) {
  const [routeKmTable, setRouteKmTable] = useState([]);
  const [routeKmForm, setRouteKmForm] = useState({ loadingLocation: '', corporation: '', unloadingLocation: '', km: '' });
  const [routeKmError, setRouteKmError] = useState('');
  const [routeKmSaving, setRouteKmSaving] = useState(false);
  const [routeKmHasChanges, setRouteKmHasChanges] = useState(false);
  const [selectedRouteKmRows, setSelectedRouteKmRows] = useState([]);
  const [routeKmEditMode, setRouteKmEditMode] = useState(false);

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      setRouteKmTable([]);
      return;
    }

    api
      .getMeta()
      .then((res) => {
        setRouteKmTable(res.data.routeKmTable || []);
        setRouteKmHasChanges(false);
      })
      .catch(() => {
        setRouteKmTable([]);
        setRouteKmHasChanges(false);
      });
  }, [user]);

  async function saveRouteKmTable() {
    setRouteKmError('');
    setRouteKmSaving(true);
    try {
      const nextTable = routeKmTable
        .filter((row) => row.loadingLocation || row.unloadingLocation || row.corporation || row.km !== '')
        .map((row) => ({
          ...row,
          loadingLocation: String(row.loadingLocation || '').trim(),
          corporation: String(row.corporation || '').trim(),
          unloadingLocation: String(row.unloadingLocation || '').trim(),
          km: Number(row.km),
        }));
      const res = await api.updateRouteKmTable(nextTable);
      setRouteKmTable(res.data.routeKmTable || []);
      setRouteKmHasChanges(false);
      setSelectedRouteKmRows([]);
      setRouteKmEditMode(false);
    } catch (err) {
      setRouteKmError(err.response?.data?.error || 'Failed to save route table');
    } finally {
      setRouteKmSaving(false);
    }
  }

  function addRouteKmRow() {
    if (!routeKmForm.loadingLocation || !routeKmForm.unloadingLocation || !routeKmForm.corporation || routeKmForm.km === '') return;

    setRouteKmTable((current) => [
      ...current,
      {
        id: `row-${Date.now()}`,
        loadingLocation: routeKmForm.loadingLocation.trim(),
        corporation: routeKmForm.corporation.trim(),
        unloadingLocation: routeKmForm.unloadingLocation.trim(),
        km: Number(routeKmForm.km),
      },
    ]);

    setRouteKmForm({ loadingLocation: '', corporation: '', unloadingLocation: '', km: '' });
    setRouteKmHasChanges(true);
  }

  function deleteSelectedRouteKmRows() {
    if (!selectedRouteKmRows.length) return;
    setRouteKmTable((current) => current.filter((row) => {
      const rowId = row.id || `${row.loadingLocation}-${row.unloadingLocation}`;
      return !selectedRouteKmRows.includes(rowId);
    }));
    setSelectedRouteKmRows([]);
    setRouteKmEditMode(false);
    setRouteKmHasChanges(true);
  }

  function updateRouteKmRow(rowId, field, value) {
    setRouteKmTable((current) => current.map((row) => (
      (row.id || `${row.loadingLocation}-${row.unloadingLocation}`) === rowId ? { ...row, [field]: field === 'km' ? Number(value) : value } : row
    )));
    setRouteKmHasChanges(true);
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>KM Table</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: 'center', padding: '8px 12px' }}>Select</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Loading Location</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Unloading Location</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Corporation</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>KM</th>
            </tr>
          </thead>
          <tbody>
            {routeKmTable.map((row) => {
              const routeRowId = row.id || `${row.loadingLocation}-${row.unloadingLocation}`;
              return (
                <tr key={routeRowId}>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedRouteKmRows.includes(routeRowId)}
                      onChange={() => setSelectedRouteKmRows((current) => (
                        current.includes(routeRowId)
                          ? current.filter((id) => id !== routeRowId)
                          : [...current, routeRowId]
                      ))}
                      aria-label={`Select route ${row.loadingLocation} to ${row.unloadingLocation}`}
                      style={{ width: 'auto' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      value={row.loadingLocation}
                      onChange={(e) => updateRouteKmRow(routeRowId, 'loadingLocation', e.target.value)}
                      placeholder="Loading location"
                      disabled={!routeKmEditMode || !selectedRouteKmRows.includes(routeRowId)}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      value={row.unloadingLocation}
                      onChange={(e) => updateRouteKmRow(routeRowId, 'unloadingLocation', e.target.value)}
                      placeholder="Unloading location"
                      disabled={!routeKmEditMode || !selectedRouteKmRows.includes(routeRowId)}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      value={row.corporation || ''}
                      onChange={(e) => updateRouteKmRow(routeRowId, 'corporation', e.target.value)}
                      disabled={!routeKmEditMode || !selectedRouteKmRows.includes(routeRowId)}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="number"
                      min="0"
                      value={row.km}
                      onChange={(e) => updateRouteKmRow(routeRowId, 'km', e.target.value)}
                      disabled={!routeKmEditMode || !selectedRouteKmRows.includes(routeRowId)}
                      style={{ width: '100%' }}
                    />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td style={{ padding: '8px 12px' }} />
              <td style={{ padding: '8px 12px' }}>
                <input
                  value={routeKmForm.loadingLocation}
                  onChange={(e) => setRouteKmForm({ ...routeKmForm, loadingLocation: e.target.value })}
                  placeholder="Loading location"
                  style={{ width: '100%' }}
                />
              </td>
              <td style={{ padding: '8px 12px' }}>
                <input
                  value={routeKmForm.unloadingLocation}
                  onChange={(e) => setRouteKmForm({ ...routeKmForm, unloadingLocation: e.target.value })}
                  placeholder="Unloading location"
                  style={{ width: '100%' }}
                />
              </td>
              <td style={{ padding: '8px 12px' }}>
                <input
                  value={routeKmForm.corporation}
                  onChange={(e) => setRouteKmForm({ ...routeKmForm, corporation: e.target.value })}
                  placeholder="Corporation"
                  style={{ width: '100%' }}
                />
              </td>
              <td style={{ padding: '8px 12px' }}>
                <input
                  type="number"
                  min="0"
                  value={routeKmForm.km}
                  onChange={(e) => setRouteKmForm({ ...routeKmForm, km: e.target.value })}
                  placeholder="KM"
                  style={{ width: '100%' }}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {routeKmError && <p className="error-text" style={{ marginTop: 12 }}>{routeKmError}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="btn secondary" onClick={addRouteKmRow}>
          Add route
        </button>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn secondary"
            disabled={!selectedRouteKmRows.length}
            onClick={() => setRouteKmEditMode(true)}
          >
            Edit selected
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={!selectedRouteKmRows.length}
            onClick={deleteSelectedRouteKmRows}
          >
            Delete selected
          </button>
          <button type="button" className="btn" disabled={!routeKmHasChanges || routeKmSaving} onClick={saveRouteKmTable}>
            {routeKmSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
