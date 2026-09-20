import { formatMonthLabel, latestCalculableMonth, monthKey } from '@kps/shared';

// Last `count` calculable months (newest first) as Select options - replaces <input type="month">.
export function calculableMonthOptions(count = 12) {
  const latest = latestCalculableMonth();
  const [year, month] = latest.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const key = monthKey(new Date(year, month - 1 - index, 1));
    return { value: key, label: formatMonthLabel(key) };
  });
}

// Same arithmetic as the web SalarySection: days of the driver's leaves that fall inside `month`.
export function leavesTakenInMonth(leaves, driverId, month) {
  return (leaves || []).reduce((totalDays, leave) => {
    if (String(leave.driver?._id || leave.driver?.id || leave.driver) !== String(driverId)) return totalDays;
    const startDate = new Date(leave.startDate);
    const monthStart = new Date(`${month}-01T00:00:00`);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
    // No endDate yet means the leave is still ongoing - treat it as open through month end.
    const endDate = leave.endDate ? new Date(leave.endDate) : monthEnd;
    if (startDate > monthEnd || endDate < monthStart) return totalDays;
    const leaveStart = startDate > monthStart ? startDate : monthStart;
    const leaveEnd = endDate < monthEnd ? endDate : monthEnd;
    const days = Math.floor((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
    return totalDays + Math.max(days, 0);
  }, 0);
}
