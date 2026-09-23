import React from 'react';

function formatMileage(km, totalDieselLitres) {
  if (km == null || totalDieselLitres == null) return 'NA';
  const distance = Number(km);
  const litres = Number(totalDieselLitres);
  if (!Number.isFinite(distance) || !Number.isFinite(litres) || litres <= 0) return 'NA';
  return `${(distance / litres).toFixed(2)} km/L`;
}

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');

// Every photo attached to the trip, in report order, with a short caption.
function collectTripPhotos(trip) {
  const photos = [];
  if (trip.parkingPhoto?.url) photos.push({ url: trip.parkingPhoto.url, caption: `Parking (${fmtDate(trip.loadingDate)})` });
  (trip.dieselEntries || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `Diesel ${fmtDate(entry.filledAt)} - Rs ${Number(entry.amount || 0)}` });
  });
  (trip.rtoEntries || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `RTO ${fmtDate(entry.date)} - Rs ${Number(entry.amount || 0)}` });
  });
  (trip.otherExpenses || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `${entry.description || 'Other'} ${fmtDate(entry.date)} - Rs ${Number(entry.amount || 0)}` });
  });
  return photos;
}

export default function EntriesSummary({ trip, corporationKm, calculatedCorporationKm }) {
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
  const totalDieselVolume = dieselEntries.reduce((sum, entry) => sum + Number(entry.volumeLitres || 0), 0);
  const totalDieselLitres = trip.settlement?.totalDieselLitres != null
    ? Number(trip.settlement.totalDieselLitres)
    : null;
  const loadingExpenseTotal = Number(trip.loadingExpense || 0);
  const parkingExpenseTotal = Number(trip.parkingExpense || 0);
  const turnExpenseTotal = Number(trip.turnExpense || 0);
  const rtoEntries = trip.rtoEntries || [];
  const rtoExpenseTotal = rtoEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const otherExpenses = trip.otherExpenses || [];
  const otherExpenseTotal = otherExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalExpenses = dieselCashTotal + loadingExpenseTotal + parkingExpenseTotal + turnExpenseTotal + rtoExpenseTotal + otherExpenseTotal;
  const balance = totalAdvance - totalExpenses;
  const photos = collectTripPhotos(trip);

  function printTripDetails() {
    const printDate = trip.loadingDate || trip.unloadingDate || new Date();
    const date = new Date(printDate);
    const datePart = [date.getDate(), date.getMonth() + 1, date.getFullYear()]
      .map((part) => String(part).padStart(2, '0'))
      .join('-');
    const cleanPart = (value) => String(value || 'NA').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
    const filename = [
      cleanPart(trip.vehicle?.vehicleNumber),
      datePart,
      cleanPart(trip.loadingLocation),
      cleanPart(trip.unloadingLocation),
    ].join('_');
    const originalTitle = document.title;
    document.title = filename;
    window.addEventListener('afterprint', () => {
      document.title = originalTitle;
    }, { once: true });
    window.print();
  }

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 10mm 12mm 12mm 12mm;
        }

        .trip-details-print-area .summary-grid {
          padding-left: 4px;
          padding-right: 4px;
        }

        .trip-details-print-area table th,
        .trip-details-print-area table td {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
          }
          .topbar,
          .container > *:not(.trip-details-print-area) {
            display: none !important;
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
            padding-left: 10px !important;
            padding-right: 10px !important;
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
            table-layout: fixed !important;
            font-size: 9pt !important;
          }
          .trip-details-print-area th,
          .trip-details-print-area td {
            padding-top: 4pt !important;
            padding-bottom: 4pt !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
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
            padding-left: 4px !important;
            padding-right: 4px !important;
          }
          .trip-details-print-area .trip-photo-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .trip-details-print-area .trip-photo-grid img {
            max-height: 60mm !important;
          }
        }
      `}</style>
      <div className="card trip-details-print-area" style={{ border: '1px solid #1f4d2b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Single Trip</h3>
          <button
            type="button"
            className="btn secondary no-print"
            onClick={printTripDetails}
            aria-label="Print trip details PDF"
            title="Print / View PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            🖨️ Single Trip
          </button>
        </div>

        <div className="summary-grid" style={{ display: 'grid', gap: 16 }}>
          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <table className="trip-overview-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ width: '10%', padding: '8px 6px 8px 12px', fontWeight: 600 }}>Customer</td>
                  <td style={{ width: '40%', padding: '8px 6px' }}>{trip.customer?.companyName || 'Unknown'}</td>
                  <td style={{ width: '32%', padding: '8px 6px', fontWeight: 600, textAlign: 'right' }}>Driver</td>
                  <td style={{ width: '18%', padding: '8px 12px 8px 6px', textAlign: 'right' }}>{trip.driverName || '-'}</td>
                </tr>
                <tr>
                  <td style={{ width: '10%', padding: '8px 6px 8px 12px', fontWeight: 600 }}>Trip Route</td>
                  <td colSpan="3" style={{ width: '90%', padding: '8px 6px' }}>
                    {trip.loadingLocation || '-'} ({trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'})
                    {' \u2192 '}{trip.unloadingLocation || '-'} ({trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'})
                    {trip.isDiverted && ` \u2192 ${trip.divertUnloadingLocation || '-'} (${trip.divertDate ? new Date(trip.divertDate).toLocaleDateString('en-IN') : '-'}) - Divert`}
                  </td>
                </tr>
                <tr>
                  <td colSpan="4" style={{ padding: '10px 0 8px' }}>
                    <table className="trip-km-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: 8 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid #1f4d2b' }}>Trip KM</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #1f4d2b' }}>Diesel for Trip</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #1f4d2b' }}>Mileage</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', textAlign: 'right' }}>{trip.odometerKm != null ? `${trip.odometerKm} km` : 'NA'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', textAlign: 'right' }}>{totalDieselLitres > 0 ? `${totalDieselLitres} L` : 'NA'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', textAlign: 'right' }}>{formatMileage(trip.odometerKm, totalDieselLitres)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <table className="trip-km-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid #1f4d2b' }}>KM Type</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #1f4d2b' }}>KM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...(trip.manualKm != null && trip.manualKm !== '' ? [['Manual KM Load', `${trip.manualKm} km (One Way)`, `${trip.loadingLocation || '-'} \u2192 ${trip.unloadingLocation || '-'}`]] : []),
                          ...(trip.manualKmDivert != null && trip.manualKmDivert !== '' ? [['Manual KM Divert', `${trip.manualKmDivert} km (One Way)`, `${trip.unloadingLocation || '-'} \u2192 ${trip.divertUnloadingLocation || '-'}`]] : []),
                          ...(trip.manualKmReturn != null && trip.manualKmReturn !== '' ? [['Manual KM Return', `${trip.manualKmReturn} km (One Way)`, `${trip.fillingOrderLocation || '-'} \u2192 ${(trip.isDiverted && trip.divertUnloadingLocation) ? trip.divertUnloadingLocation : (trip.unloadingLocation || '-')}`]] : []),
                          ['Driver KM', calculatedCorporationKm != null ? `${calculatedCorporationKm} km` : 'NA', null],
                        ].map(([label, value, locations]) => (
                          <tr key={label}>
                            <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', fontWeight: 600 }}>
                              {label}
                              {locations && <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>{locations}</div>}
                            </td>
                            <td style={{ padding: '8px 12px', border: '1px solid #1f4d2b', textAlign: 'right' }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Driver Advance Details</h3>
            <table className="trip-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
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
            <table className="trip-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px 8px 0' }}>Purchase Type</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px 8px 0' }}>Odometer KM</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px 8px 0' }}>Litres</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px 8px 0' }}>Tank Fill</th>
                  <th style={{ textAlign: 'right', padding: '8px 0 8px 12px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {dieselEntries.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '8px 0', color: '#666' }}>No diesel entries added yet.</td>
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
                      <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>{entry.odometerKm ?? '-'}</td>
                      <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>{entry.volumeLitres != null ? `${Number(entry.volumeLitres)} L` : '-'}</td>
                      <td style={{ padding: '8px 12px 8px 0', textAlign: 'center' }}>{entry.loadingPointTankFill ? '✓' : '-'}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                    </tr>
                  ))
                )}
                <tr style={{ borderTop: '1px solid #dfeade' }}>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}>Diesel Card</td>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '12px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '12px 0 0 0', textAlign: 'right' }}>Rs {dieselCardTotal}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}>Cash</td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 0 0 0', textAlign: 'right' }}>Rs {dieselCashTotal}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}>Total</td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0', textAlign: 'right' }}>{totalDieselVolume} L</td>
                  <td style={{ fontWeight: 700, padding: '8px 12px 0 0' }}> </td>
                  <td style={{ fontWeight: 700, padding: '8px 0 0 0', textAlign: 'right' }}>Rs {totalDiesel}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Expenses</h3>
            <table className="trip-expenses-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td colSpan="4" style={{ padding: '8px 12px', fontWeight: 700, background: '#f7faf7' }}>Expenses</td>
                </tr>
                <tr>
                  <td colSpan="4" style={{ padding: 0 }}>
                    <table className="trip-detail-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '8px 12px 8px 12px' }}>Cleaner Loading</td>
                          <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {loadingExpenseTotal}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px 8px 12px' }}>Turn</td>
                          <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {turnExpenseTotal}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px 8px 12px' }}>Parking</td>
                          <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {parkingExpenseTotal}</td>
                        </tr>
                        {rtoEntries.map((entry, index) => (
                          <tr key={`rto-${index}`}>
                            <td style={{ padding: '8px 12px 8px 12px' }}>RTO</td>
                            <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '-'}</td>
                            <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                          </tr>
                        ))}
                        {otherExpenses.map((entry, index) => (
                          <tr key={`other-${index}`}>
                            <td style={{ padding: '8px 12px 8px 12px' }}>{entry.description || 'Other'}</td>
                            <td style={{ padding: '8px 12px 8px 0', color: '#666' }}>{entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '-'}</td>
                            <td style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>Rs {Number(entry.amount || 0)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1px solid #dfeade' }}>
                          <td style={{ padding: '8px 12px 8px 12px', fontWeight: 600 }}>Subtotal</td>
                          <td style={{ padding: '8px 12px 8px 0' }}> </td>
                          <td style={{ padding: '8px 12px 8px 0', fontWeight: 600, textAlign: 'right' }}>Rs {totalExpenses}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr style={{ borderTop: '1px solid #dfeade' }}>
                  <td colSpan="3" style={{ fontWeight: 700, padding: '12px 12px 0 0' }}>Total</td>
                  <td style={{ fontWeight: 700, padding: '12px 0 0 0', textAlign: 'right' }}>Rs {totalExpenses}</td>
                </tr>
                <tr>
                  <td colSpan="3" style={{ padding: '8px 12px 0 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1f2d1f' }}>Balance</span>
                      <span style={{ fontWeight: 500, color: '#4a5f52', fontSize: 11 }}>(Driver Advance - Expenses Total)</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 0 0 0', textAlign: 'right', fontWeight: 800, fontSize: 16, color: '#1f2d1f' }}>Rs {balance}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {photos.length > 0 && (
            <div className="card-section" style={{ border: '1px solid #dfeade', borderRadius: 10, overflow: 'hidden' }}>
              <h3 style={{ margin: 0, padding: '10px 12px', background: '#f7faf7', borderBottom: '1px solid #dfeade' }}>Trip Photos</h3>
              <div className="trip-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, padding: 12 }}>
                {photos.map((photo, index) => (
                  <figure key={`${photo.url}-${index}`} style={{ margin: 0, border: '1px solid #dfeade', borderRadius: 8, overflow: 'hidden', breakInside: 'avoid' }}>
                    <a href={photo.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#f7faf7' }}>
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        loading="lazy"
                        style={{ display: 'block', width: '100%', height: 160, objectFit: 'contain' }}
                      />
                    </a>
                    <figcaption style={{ padding: '6px 8px', fontSize: 12, textAlign: 'center', color: '#4b5f52' }}>{photo.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
