import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../api/api';
import {
  buildDieselVerificationRows,
  formatVerificationDate,
  formatVerificationKilometres,
  formatVerificationLitres,
  formatVerificationMileage,
  getDieselVerificationDateRange,
} from './dieselVerificationData';

const cellStyle = { padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' };
const REFRESH_INTERVAL_MS = 30_000;

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function errorMessage(error, fallback) {
  return error.response?.data?.error || fallback;
}

async function loadComparisonUploads(vehicleId, vehicleNumber, trips, month, monthUploads = []) {
  const dateRange = getDieselVerificationDateRange(trips, month, monthUploads, vehicleNumber);
  if (!dateRange) return monthUploads;
  const response = await api.listDieselVerifications({ vehicleId, ...dateRange });
  const uploadsById = new Map(
    [...monthUploads, ...(response.data.uploads || [])].map((upload) => [upload._id, upload])
  );
  return [...uploadsById.values()];
}

export default function DieselVerificationSection({ vehicles, loading: vehiclesLoading }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [file, setFile] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [comparisonUploads, setComparisonUploads] = useState([]);
  const [trips, setTrips] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  function clearSelectedFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const vehicleId = selectedVehicleId && vehicles.some((vehicle) => String(vehicle._id) === selectedVehicleId)
    ? selectedVehicleId
    : String(vehicles[0]?._id || '');
  const selectedVehicle = vehicles.find((vehicle) => String(vehicle._id) === vehicleId);
  const selectedVehicleNumberRef = useRef(selectedVehicle?.vehicleNumber || '');
  selectedVehicleNumberRef.current = selectedVehicle?.vehicleNumber || '';

  useEffect(() => {
    setSelectedVehicleId((currentId) => (
      vehicles.some((vehicle) => String(vehicle._id) === String(currentId))
        ? currentId
        : String(vehicles[0]?._id || '')
    ));
  }, [vehicles]);

  useEffect(() => {
    if (!vehicleId || !month) {
      setUploads([]);
      setComparisonUploads([]);
      setTrips([]);
      return undefined;
    }

    let active = true;
    let requestInFlight = false;
    setUploads([]);
    setComparisonUploads([]);
    setTrips([]);

    async function refreshData(initialLoad = false) {
      if (!active || requestInFlight || document.visibilityState === 'hidden') return;
      requestInFlight = true;
      if (initialLoad) {
        setDataLoading(true);
        setError('');
      }

      try {
        const [uploadResponse, tripResponse] = await Promise.all([
          api.listDieselVerifications({ vehicleId, month }),
          api.listTripsForVehicle(vehicleId),
        ]);
        const nextTrips = tripResponse.data.trips || [];
        const monthUploads = uploadResponse.data.uploads || [];
        const nextComparisonUploads = await loadComparisonUploads(
          vehicleId,
          selectedVehicleNumberRef.current,
          nextTrips,
          month,
          monthUploads
        );
        if (active) {
          setUploads(monthUploads);
          setComparisonUploads(nextComparisonUploads);
          setTrips(nextTrips);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(errorMessage(requestError, 'Failed to load diesel verification data'));
      } finally {
        requestInFlight = false;
        if (active) setDataLoading(false);
      }
    }

    function refreshOnFocus() {
      refreshData();
    }

    refreshData(true);
    const intervalId = window.setInterval(() => refreshData(), REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [vehicleId, month]);

  const rows = useMemo(
    () => buildDieselVerificationRows(trips, month, comparisonUploads, selectedVehicle?.vehicleNumber),
    [trips, month, comparisonUploads, selectedVehicle?.vehicleNumber]
  );

  async function handleUpload(event) {
    event.preventDefault();
    if (!file || !vehicleId) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.createDieselVerification({ vehicleId, month }, file);
      clearSelectedFile();
      setMessage('Monthly fuel statement uploaded.');
      try {
        const uploadResponse = await api.listDieselVerifications({ vehicleId, month });
        const monthUploads = uploadResponse.data.uploads || [];
        const nextComparisonUploads = await loadComparisonUploads(
          vehicleId,
          selectedVehicle?.vehicleNumber,
          trips,
          month,
          monthUploads
        );
        setUploads(monthUploads);
        setComparisonUploads(nextComparisonUploads);
      } catch (refreshError) {
        setError(`The statement was uploaded, but its list could not be refreshed: ${errorMessage(refreshError, 'Request failed')}`);
      }
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'Failed to upload diesel statement'));
    } finally {
      setSaving(false);
    }
  }

  async function downloadUpload(upload) {
    setDownloadingId(upload._id);
    setError('');
    try {
      const response = await api.downloadDieselVerificationFile(upload._id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = upload.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(errorMessage(downloadError, 'Failed to download diesel statement'));
    } finally {
      setDownloadingId('');
    }
  }

  async function deleteUpload(upload) {
    if (!window.confirm(`Delete "${upload.originalName}"? This cannot be undone.`)) return;

    setDeletingId(upload._id);
    setError('');
    setMessage('');
    try {
      await api.deleteDieselVerification(upload._id);
      setUploads((current) => current.filter((entry) => entry._id !== upload._id));
      setComparisonUploads((current) => current.filter((entry) => entry._id !== upload._id));
      setMessage('Diesel statement deleted.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Failed to delete diesel statement'));
    } finally {
      setDeletingId('');
    }
  }

  return (
    <section className="card" aria-labelledby="diesel-verification-title" style={{ order: 9999 }}>
      <h3 id="diesel-verification-title" className="section-title" style={{ marginTop: 0 }}>
        Diesel Verification &amp; DEF
      </h3>
      {vehiclesLoading ? <p>Loading vehicles...</p> : vehicles.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No vehicles available for diesel verification.</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'end', gap: 14, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 220 }}>
              <label htmlFor="diesel-verification-vehicle">Select Vehicle</label>
              <select
                id="diesel-verification-vehicle"
                value={vehicleId}
                onChange={(event) => {
                  setSelectedVehicleId(event.target.value);
                  clearSelectedFile();
                  setMessage('');
                  setError('');
                }}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle._id} value={String(vehicle._id)}>
                    {vehicle.vehicleNumber}{vehicle.driverName ? ` | ${vehicle.driverName}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="diesel-verification-month">Report Month</label>
              <input
                id="diesel-verification-month"
                type="month"
                required
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  clearSelectedFile();
                  setMessage('');
                  setError('');
                }}
              />
            </div>
          </div>

          <form onSubmit={handleUpload} style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', margin: '4px 0 20px' }}>
            <div className="field" style={{ minWidth: 260 }}>
              <label htmlFor="diesel-verification-file">Monthly Diesel / DEF statement (PDF, Excel .xls/.xlsx, or CSV)</label>
              <input
                id="diesel-verification-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                required
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
              <small>
                One customer statement can include multiple vehicles. Upload each distinct file once; exact duplicate files are rejected.
                Statement date columns may be Date, Settlement Date, Transaction Date, or Txn Date. Include Diesel / DEF quantity columns or a Product and Quantity column. PDFs must contain selectable text.
              </small>
            </div>
            {file && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearSelectedFile}
                disabled={saving}
              >
                Remove selected file
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={!file || saving}>
              {saving ? 'Uploading...' : 'Upload Statement'}
            </button>
          </form>

          {error && <p className="error-text" role="alert">{error}</p>}
          {message && <p role="status" style={{ color: '#257044' }}>{message}</p>}

          <h4 style={{ margin: '0 0 8px' }}>Customer statements — {month}</h4>
          {uploads.length === 0 ? (
            <p style={{ color: '#666' }}>No statements uploaded for {selectedVehicle?.vehicleNumber} in this month.</p>
          ) : (
            <ul style={{ margin: '0 0 20px', paddingLeft: 20 }}>
              {uploads.map((upload) => (
                <li key={upload._id} style={{ marginBottom: 6 }}>
                  <span>{upload.originalName} · {formatVerificationDate(upload.createdAt)}</span>{' '}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={downloadingId === upload._id || deletingId === upload._id}
                    onClick={() => downloadUpload(upload)}
                  >
                    {downloadingId === upload._id ? 'Downloading...' : 'Download'}
                  </button>
                  {' '}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={downloadingId === upload._id || deletingId === upload._id}
                    onClick={() => deleteUpload(upload)}
                    aria-label={`Delete ${upload.originalName}`}
                  >
                    {deletingId === upload._id ? 'Deleting...' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h4 style={{ margin: '0 0 8px' }}>Trip comparison — {selectedVehicle?.vehicleNumber}</h4>
          <small>
            Diesel from document is summed from the previous trip&apos;s Load Turn date through this trip&apos;s Load Turn date.
            Trip and statement data refresh automatically every 30 seconds while this page is open.
          </small>
          {dataLoading ? <p>Loading trips and statements...</p> : rows.length === 0 ? (
            <p style={{ color: '#666' }}>No trips found for this vehicle in {month}.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1500, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={cellStyle}>S.No</th>
                    <th style={cellStyle}>Loading</th>
                    <th style={cellStyle}>Load Weight (tons)</th>
                    <th style={cellStyle}>Unloading</th>
                    <th style={cellStyle}>Unloading Date</th>
                    <th style={cellStyle}>Trip KM</th>
                    <th style={cellStyle}>Mileage</th>
                    <th style={cellStyle}>Diesel for Trip</th>
                    <th style={cellStyle}>Diesel added in trip</th>
                    <th style={cellStyle}>Diesel from Document</th>
                    <th style={cellStyle}>DEF for Trip</th>
                    <th style={cellStyle}>DEF added in trip</th>
                    <th style={cellStyle}>DEF from Document</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td style={cellStyle}>{index + 1}</td>
                      <td style={cellStyle}>{row.loading || '—'}</td>
                      <td style={cellStyle}>{row.loadingWeightTons == null
                        ? '—'
                        : `${Number(row.loadingWeightTons).toLocaleString('en-IN', { maximumFractionDigits: 2 })} t`}</td>
                      <td style={cellStyle}>{row.unloading || '—'}</td>
                      <td style={cellStyle}>{formatVerificationDate(row.unloadingDate)}</td>
                      <td style={cellStyle}>{formatVerificationKilometres(row.tripKm)}</td>
                      <td style={cellStyle}>{formatVerificationMileage(row.mileageKmPerLitre)}</td>
                      <td style={cellStyle}>{formatVerificationLitres(row.dieselForTrip)}</td>
                      <td style={cellStyle}>{formatVerificationLitres(row.tripDiesel)}</td>
                      <td style={cellStyle}>{formatVerificationLitres(row.dieselFromDocument)}</td>
                      <td style={cellStyle}>{formatVerificationLitres(row.defForTrip)}</td>
                      <td style={cellStyle}>{formatVerificationLitres(row.defAdded)}</td>
                      <td style={cellStyle}>{formatVerificationLitres(row.defFromDocument)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
