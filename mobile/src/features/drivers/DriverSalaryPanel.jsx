import React, { useCallback, useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatDate, formatMonthLabel, latestCalculableMonth } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { confirm } from '../../confirm';
import { Button, Card, ErrorText, Loading, Muted, Row, Select } from '../../ui';
import { SectionTitle } from '../../trip/common';
import { spacing } from '../../theme';
import { calculableMonthOptions } from '../salary/months';
import { SalarySummary, SalaryTrips } from './SalaryTables';

const totalsOf = (salary) => ({
  corporationKm: salary.corporationKm,
  totalDieselLitres: salary.totalDieselLitres,
  totalDiesel: salary.totalDiesel,
  totalAdvance: salary.totalAdvance,
  totalExpense: salary.totalExpense,
  totalBalance: salary.totalBalance,
});

// Port of DriverSalaryPanel: month picker, per-trip rows with force-close, summary, PDF share.
export default function DriverSalaryPanel({ customerId, driverId, data, driver, vehicle, setError }) {
  const [salaryMonth, setSalaryMonth] = useState(latestCalculableMonth);
  const [salary, setSalary] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(true);
  const [salaryError, setSalaryError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [closingTripId, setClosingTripId] = useState(null);

  const loadSalary = useCallback(() => {
    if (!driver) return;
    setSalaryError('');
    setSalaryLoading(true);
    api.getDriverMonthlySalary(customerId, driverId, salaryMonth)
      .then((res) => setSalary(res.data))
      .catch((err) => {
        setSalary(null);
        setSalaryError(errorMessage(err, 'Failed to load salary calculation'));
      })
      .finally(() => setSalaryLoading(false));
  }, [customerId, driver, driverId, salaryMonth]);

  useEffect(loadSalary, [loadSalary]);

  async function closeTripFromSalary(tripId) {
    if (!(await confirm('Mark this trip as closed for salary purposes?', 'Close'))) return;
    setError('');
    setClosingTripId(tripId);
    try {
      await api.closeTrip(tripId);
      loadSalary();
    } catch (err) {
      setError(errorMessage(err, 'Failed to close trip'));
    } finally {
      setClosingTripId(null);
    }
  }

  // Downloads the server PDF (short-lived token in the URL) to the cache and opens the share sheet.
  // `which` is 'regular' (driver's own PDF) or 'temporary' (temporary driver's PDF).
  async function shareSalaryPdf(which = 'regular') {
    setSharing(true);
    setError('');
    try {
      const url = await api.getDriverMonthlySummaryUrl(customerId, driverId, salaryMonth, which);
      const personName = which === 'temporary' ? `${salary?.temporaryDriver?.name || 'temporary'}-temporary` : (driver.name || driver.username || 'driver');
      const safeName = String(personName).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const target = new File(Paths.cache, `salary-${safeName}-${salaryMonth}.pdf`);
      const file = await File.downloadFileAsync(url, target, { idempotent: true });
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate monthly summary'));
    } finally {
      setSharing(false);
    }
  }

  return (
    <Card title="Salary Calculation">
      <Row label="Customer" value={data.customer?.companyName || '-'} />
      <Row label="Driver" value={driver.name || driver.username || '-'} />
      <Row label="Vehicle" value={vehicle?.vehicleNumber || '-'} />
      <Row label="Month" value={formatMonthLabel(salaryMonth)} />
      <Muted style={{ marginVertical: spacing.md }}>
        Salary for a month is calculated at the end of the following month (latest available: {formatMonthLabel(latestCalculableMonth())}).
      </Muted>
      <Select label="Salary Month" value={salaryMonth} options={calculableMonthOptions()} onChange={(month) => { if (month) setSalaryMonth(month); }} />
      <Button
        title="Share salary PDF"
        onPress={() => shareSalaryPdf('regular')}
        loading={sharing}
        disabled={!salary}
        style={{ marginBottom: spacing.md }}
      />
      {salaryError ? <ErrorText>{salaryError}</ErrorText> : salaryLoading || !salary ? <Loading text="Loading salary calculation..." /> : (
        <>
          <SalaryTrips trips={salary.trips} closingTripId={closingTripId} onCloseTrip={closeTripFromSalary} totals={totalsOf(salary)} />
          <SalarySummary salary={salary} />
          {salary.temporaryDriver && (
            <>
              <SectionTitle>
                Temporary Driver: {salary.temporaryDriver.name} ({formatDate(salary.temporaryDriver.joiningDate)} - {salary.temporaryDriver.returningDate ? formatDate(salary.temporaryDriver.returningDate) : 'Ongoing'})
              </SectionTitle>
              <Button
                title="Share temporary driver PDF"
                variant="secondary"
                onPress={() => shareSalaryPdf('temporary')}
                loading={sharing}
                style={{ marginBottom: spacing.md }}
              />
              <SalaryTrips
                trips={salary.temporaryDriver.trips}
                closingTripId={closingTripId}
                onCloseTrip={closeTripFromSalary}
                totals={totalsOf(salary.temporaryDriver)}
              />
              <SalarySummary salary={salary.temporaryDriver} />
            </>
          )}
        </>
      )}
    </Card>
  );
}
