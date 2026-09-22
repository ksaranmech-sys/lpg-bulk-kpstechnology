import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { latestCalculableMonth, formatMonthLabel } from '@kps/shared';
import * as api from '../../api/api';

export default function SalarySection({ user, customerData, driverUsers, leaves, leavesLoading }) {
  const [driverSalaries, setDriverSalaries] = useState({});
  const [driverSalariesLoading, setDriverSalariesLoading] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState(latestCalculableMonth);
  const [showArchivedSalary, setShowArchivedSalary] = useState(false);

  useEffect(() => {
    if (user?.role !== 'customer_admin' || !user.customer || driverUsers.length === 0) {
      setDriverSalaries({});
      return;
    }
    setDriverSalariesLoading(true);
    Promise.all(driverUsers.map((driver) => (
      api.getDriverMonthlySalary(user.customer, driver.id || driver._id, salaryMonth)
        .then((res) => [driver.id || driver._id, res.data])
        .catch(() => [driver.id || driver._id, null])
    )))
      .then((entries) => setDriverSalaries(Object.fromEntries(entries)))
      .finally(() => setDriverSalariesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, driverUsers.length, salaryMonth]);

  return (
    <div className="card customer-admin-salary-section" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Salary Details ({formatMonthLabel(salaryMonth)})</h3>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
        Salary for a month is calculated at the end of the following month (latest available: {formatMonthLabel(latestCalculableMonth())}).
      </p>
      {driverUsers.length === 0 ? (
        <p>No drivers found.</p>
      ) : driverSalariesLoading ? (
        <p>Loading salary details...</p>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {driverUsers.map((driver) => {
            const driverId = driver.id || driver._id;
            const salary = driverSalaries[driverId];
            const leavesTaken = leaves.reduce((totalDays, leave) => {
              if (String(leave.driver?._id || leave.driver?.id || leave.driver) !== String(driverId)) return totalDays;
              const startDate = new Date(leave.startDate);
              const monthStart = new Date(`${salaryMonth}-01T00:00:00`);
              const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
              // No endDate yet means the leave is still ongoing - treat it as open through month end.
              const endDate = leave.endDate ? new Date(leave.endDate) : monthEnd;
              if (startDate > monthEnd || endDate < monthStart) return totalDays;
              const leaveStart = startDate > monthStart ? startDate : monthStart;
              const leaveEnd = endDate < monthEnd ? endDate : monthEnd;
              const days = Math.floor((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
              return totalDays + Math.max(days, 0);
            }, 0);
            const vehicleNumber = customerData?.vehicles?.find((vehicle) => String(vehicle._id) === String(driver.vehicle))?.vehicleNumber || 'Unassigned';
            return (
              <div key={driverId} style={{ overflowX: 'auto' }}>
                <div className="salary-summary-block">
                  <div className="salary-summary-identity">
                    <div><strong>Customer Name:</strong> {customerData?.customer?.companyName || '-'}</div>
                    <div>
                      <strong>Driver Name:</strong>{' '}
                      <Link to={`/drivers/${user.customer}/${driverId}`}>{driver.displayName || driver.name || 'Unnamed driver'}</Link>
                    </div>
                    <div><strong>Vehicle Number:</strong> {vehicleNumber}</div>
                    <div><strong>Driver Mobile Number:</strong> {driver.mobileNumber || 'No phone'}</div>
                  </div>
                  <table className="salary-summary" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Basic Salary Payable</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Corporation KM</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>KM Beta</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Special Trip Charges</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Balance</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Salary Balance</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Payable Days</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px' }}>Leaves Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {!salary ? (
                        <td colSpan={8} style={{ padding: '8px 12px', color: '#666' }}>
                          Not available
                        </td>
                      ) : (
                        <>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs {Math.round(salary.basicSalary || 0)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{Math.round(salary.corporationKm || 0)} km</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs {Math.round(salary.kmBeta || 0)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs {Math.round(salary.specialTripCharges || 0)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs {Math.round(salary.totalBalance || 0)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Rs {Math.round(salary.salaryBalance || 0)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{salary.payableDays}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{leavesLoading ? '...' : leavesTaken}</td>
                        </>
                      )}
                    </tr>
                  </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="salary-archive-footer">
        <button
          type="button"
          className="salary-archive-link"
          onClick={() => setShowArchivedSalary((current) => !current)}
        >
          {showArchivedSalary ? 'Hide archived salary' : 'View archived salary'}
        </button>
        {showArchivedSalary && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="salary-month">Salary Month</label>
            <input
              id="salary-month"
              type="month"
              value={salaryMonth}
              max={latestCalculableMonth()}
              onChange={(event) => setSalaryMonth(event.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
