import React, { useEffect, useState } from 'react';
import { latestCalculableMonth, formatMonthLabel } from '@kps/shared';
import * as api from '../../api/api';
import SalaryTripsTable from './SalaryTripsTable';
import SalarySummaryTable from './SalarySummaryTable';

export default function DriverSalaryPanel({ customerId, driverId, data, driver, vehicle, setError }) {
  const [salaryMonth, setSalaryMonth] = useState(latestCalculableMonth);
  const [salary, setSalary] = useState(null);
  const [salaryError, setSalaryError] = useState('');
  const [showArchivedSalary, setShowArchivedSalary] = useState(false);
  const [archivedSalaryMonth, setArchivedSalaryMonth] = useState(latestCalculableMonth);
  const [archivedSalary, setArchivedSalary] = useState(null);
  const [summaryPrinting, setSummaryPrinting] = useState(false);
  const [closingTripId, setClosingTripId] = useState(null);

  function loadSalary() {
    if (!driver) return;
    setSalaryError('');
    api
      .getDriverMonthlySalary(customerId, driverId, salaryMonth)
      .then((res) => setSalary(res.data))
      .catch((err) => {
        setSalary(null);
        setSalaryError(err.response?.data?.error || 'Failed to load salary calculation');
      });
  }

  useEffect(loadSalary, [customerId, driver, driverId, salaryMonth]);

  // Only used to know whether the archived month had a temporary driver.
  useEffect(() => {
    if (!showArchivedSalary || !driver || !archivedSalaryMonth) return;
    let cancelled = false;
    setArchivedSalary(null);
    api
      .getDriverMonthlySalary(customerId, driverId, archivedSalaryMonth)
      .then((res) => { if (!cancelled) setArchivedSalary(res.data); })
      .catch(() => { if (!cancelled) setArchivedSalary(null); });
    return () => { cancelled = true; };
  }, [showArchivedSalary, customerId, driver, driverId, archivedSalaryMonth]);

  async function closeTripFromSalary(tripId) {
    if (!window.confirm('Mark this trip as closed for salary purposes?')) return;
    setError('');
    setClosingTripId(tripId);
    try {
      await api.closeTrip(tripId);
      loadSalary();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close trip');
    } finally {
      setClosingTripId(null);
    }
  }

  async function printMonthlySummary(month = salaryMonth, which = 'regular') {
    const printWindow = window.open('', '_blank');
    setSummaryPrinting(true);
    try {
      // Open the server URL directly (with a short-lived token) so the PDF viewer's Save
      // suggests the Content-Disposition filename - blob URLs always save as a random UUID.
      const url = await api.getDriverMonthlySummaryUrl(customerId, driverId, month, which);
      if (printWindow) printWindow.location.href = url;
      else window.location.href = url;
    } catch (err) {
      printWindow?.close();
      setError(err.response?.data?.error || 'Failed to generate monthly summary');
    } finally {
      setSummaryPrinting(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div><strong>Customer:</strong> {data.customer?.companyName || '-'}</div>
          <div><strong>Driver:</strong> {driver.name || driver.username || '-'}</div>
          <div style={{ textAlign: 'center' }}><strong>Vehicle:</strong> {vehicle?.vehicleNumber || '-'}</div>
          <div style={{ textAlign: 'right' }}><strong>Month:</strong> {formatMonthLabel(salaryMonth)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Salary Calculation</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              aria-label="Salary month"
              type="month"
              value={salaryMonth}
              max={latestCalculableMonth()}
              onChange={(event) => setSalaryMonth(event.target.value)}
              style={{ maxWidth: 170 }}
            />
            <button
              type="button"
              className="btn"
              onClick={() => printMonthlySummary(salaryMonth, 'regular')}
              disabled={!salary || summaryPrinting}
            >
              {summaryPrinting ? 'Preparing...' : 'Print Salary PDF'}
            </button>
          </div>
        </div>
        <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
          Salary for a month is calculated from the 5th of the following month (latest available: {formatMonthLabel(latestCalculableMonth())}).
        </p>
        {salaryError ? <p className="error-text" style={{ margin: 0 }}>{salaryError}</p>
          : !salary ? <p style={{ margin: 0 }}>Loading salary calculation...</p> : (
          <>
            <SalaryTripsTable
              trips={salary.trips}
              closingTripId={closingTripId}
              onCloseTrip={closeTripFromSalary}
              totals={{
                corporationKm: salary.corporationKm,
                totalDieselLitres: salary.totalDieselLitres,
                totalDiesel: salary.totalDiesel,
                totalAdvance: salary.totalAdvance,
                totalExpense: salary.totalExpense,
                totalBalance: salary.totalBalance,
              }}
            />
            <SalarySummaryTable salary={salary} />
            {salary.temporaryDriver && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h4 className="section-title" style={{ margin: 0 }}>
                    Temporary Driver: {salary.temporaryDriver.name} ({new Date(salary.temporaryDriver.joiningDate).toLocaleDateString('en-IN')} - {salary.temporaryDriver.returningDate ? new Date(salary.temporaryDriver.returningDate).toLocaleDateString('en-IN') : 'Ongoing'})
                  </h4>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => printMonthlySummary(salaryMonth, 'temporary')}
                    disabled={summaryPrinting}
                  >
                    {summaryPrinting ? 'Preparing...' : 'Print Temporary Driver PDF'}
                  </button>
                </div>
                <SalaryTripsTable
                  trips={salary.temporaryDriver.trips}
                  closingTripId={closingTripId}
                  onCloseTrip={closeTripFromSalary}
                  totals={{
                    corporationKm: salary.temporaryDriver.corporationKm,
                    totalDieselLitres: salary.temporaryDriver.totalDieselLitres,
                    totalDiesel: salary.temporaryDriver.totalDiesel,
                    totalAdvance: salary.temporaryDriver.totalAdvance,
                    totalExpense: salary.temporaryDriver.totalExpense,
                    totalBalance: salary.temporaryDriver.totalBalance,
                  }}
                />
                <SalarySummaryTable salary={salary.temporaryDriver} />
              </div>
            )}
          </>
        )}
      </div>
      <div className="salary-archive-footer">
        <button
          type="button"
          className="salary-archive-link"
          onClick={() => {
            setShowArchivedSalary((current) => {
              return !current;
            });
          }}
        >
          {showArchivedSalary ? 'Hide archived Salary PDF' : 'View archived Salary PDF'}
        </button>
      </div>
      {showArchivedSalary && (
        <div className="card" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label htmlFor="archived-salary-month" style={{ margin: 0 }}>Archive month</label>
          <input
            id="archived-salary-month"
            aria-label="Archived salary month"
            type="month"
            value={archivedSalaryMonth}
            max={latestCalculableMonth()}
            onChange={(event) => setArchivedSalaryMonth(event.target.value)}
            style={{ maxWidth: 170 }}
          />
          <button type="button" className="btn" onClick={() => printMonthlySummary(archivedSalaryMonth, 'regular')} disabled={!archivedSalaryMonth || summaryPrinting}>
            {summaryPrinting ? 'Preparing...' : 'Print archived Salary PDF'}
          </button>
          {archivedSalary?.temporaryDriver && (
            <button type="button" className="btn" onClick={() => printMonthlySummary(archivedSalaryMonth, 'temporary')} disabled={summaryPrinting}>
              {summaryPrinting ? 'Preparing...' : `Print archived Temporary Driver PDF (${archivedSalary.temporaryDriver.name || 'Temporary Driver'})`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
