import React from 'react';

// Shared salary summary (Basic Salary/KM Beta/Special Trip Charges/Expenses/Advance/Settlement)
// used for both the regular driver and, when assigned, the temporary driver.
export default function SalarySummaryTable({ salary }) {
  return (
    <table className="salary-summary">
      <tbody>
        <tr>
          <td>
            {salary.payableDays != null
              ? `Basic salary (Payable days: ${salary.payableDays}, Leaves taken: ${salary.unpaidLeaveDays})`
              : `Basic salary (Days covered: ${salary.days})`}
          </td>
          <td>Rs {Math.round(salary.basicSalary || 0)}</td>
        </tr>
        <tr><td>KM Beta (Total Driver KM {Math.round(salary.corporationKm || 0)} x Rs {salary.kmCharges || 0})</td><td>Rs {Math.round(salary.kmBeta || 0)}</td></tr>
        {Number(salary.specialTripCharges || 0) > 0 && (
          <tr><td>Special Trip Charges ({salary.specialTripCount || 0} trips x Rs 1000{Number(salary.specialTripCharges || 0) !== Number(salary.specialTripCount || 0) * 1000 ? ', split by date with temporary driver' : ''})</td><td>Rs {Math.round(salary.specialTripCharges || 0)}</td></tr>
        )}
        <tr><td>Total Expenses ({salary.closedTrips} trips)</td><td>Rs {Math.round(salary.totalExpense || 0)}</td></tr>
        <tr><td><strong>Sub Total</strong></td><td><strong>Rs {Math.round((salary.basicSalary || 0) + (salary.kmBeta || 0) + (salary.specialTripCharges || 0) + (salary.totalExpense || 0))}</strong></td></tr>
        <tr><td>Total Advance ({salary.closedTrips} trips)</td><td>Rs {Math.round(salary.totalAdvance || 0)}</td></tr>
        <tr><td><strong>Settlement</strong></td><td><strong>Rs {Math.round(salary.salaryBalance || 0)}</strong></td></tr>
      </tbody>
    </table>
  );
}
