import { formatDateLong, formatMonthLabel } from '@kps/shared';

const money = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyNumber = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const totalNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value) {
  return Number.isFinite(value) ? money.format(value) : 'NA';
}

function formatMoneyNumber(value) {
  return Number.isFinite(value) ? moneyNumber.format(value) : 'NA';
}

function formatTotal(value) {
  if (!Number.isFinite(value)) return 'NA';
  return totalNumber.format(value);
}

function renderTotals(label, totals, strong = false, currencyPrefix = false) {
  return `<table class="totals"><tbody><tr>
    <th>${escapeHtml(`${currencyPrefix ? '₹' : ''}${label}`)}</th>
    <td>Trip Income ${formatTotal(totals.tripIncome)}</td>
    <td>Shortage ${formatTotal(totals.shortage)}</td>
    <td>TDS ${formatTotal(totals.tds)}</td>
    <td>Diesel ${formatTotal(totals.diesel)}</td>
    <td${strong ? ' class="strong"' : ''}>Amount ${formatTotal(totals.amount)}</td>
  </tr></tbody></table>`;
}

function renderState(state) {
  const corporationLabel = state.corporation ? ` (${state.corporation} routes)` : '';
  const rows = state.rows.map((trip) => `<tr>
    <td>${escapeHtml(trip.sNo)}</td>
    <td>${escapeHtml(trip.vehicleNumber || '-')}</td>
    <td>${escapeHtml(trip.loadingLocation || '-')}</td>
    <td>${escapeHtml(trip.unloadingLocation || '-')}</td>
    <td>${escapeHtml(trip.loadingDate ? formatDateLong(trip.loadingDate) : '-')}</td>
    <td>${escapeHtml(trip.unloadingDate ? formatDateLong(trip.unloadingDate) : '-')}</td>
    <td class="number">${formatMoneyNumber(trip.tripIncome)}${trip.leg === 'divert' ? '<br>Divert (new unloading)' : ''}</td>
    <td class="number">${formatMoney(trip.shortage)}</td>
    <td class="number">${formatMoney(trip.tds)}</td>
    <td class="number">${formatMoney(trip.diesel)}</td>
    <td class="number">${formatMoney(trip.amount)}</td>
  </tr>`).join('');

  return `<section class="state">
    <h4>${escapeHtml(state.state)}${escapeHtml(corporationLabel)} <span>- ${state.totals.trips} unloading${state.totals.trips === 1 ? '' : 's'}</span></h4>
    <table class="income">
      <thead><tr>
        <th>S.No</th><th>Vehicle Number</th><th>Loading location</th><th>Unloading location</th>
        <th>Loading date</th><th>Unloading date</th><th>Trip Income</th><th>Shortage</th>
        <th>TDS</th><th>Diesel</th><th>Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${renderTotals(`Total ${state.corporation || state.state}`, state.totals, false, true)}
  </section>`;
}

export function buildMonthlyIncomeHtml(income, month, generatedOn = formatDateLong(new Date())) {
  const groups = (income?.groups || []).map((group) => {
    const periods = group.periods.map((period) => `<section class="period">
      <h3>${escapeHtml(period.label)} <span>- ${period.totals.trips} unloadings</span></h3>
      ${period.states.map(renderState).join('')}
      ${period.states.length > 1 ? renderTotals(`Total ${group.vehicleCorporation} - ${period.label}`, period.totals) : ''}
    </section>`).join('');
    return `<section class="corporation">
      <h2>${escapeHtml(group.vehicleCorporation)} <span>- ${group.totals.trips} unloadings</span></h2>
      ${periods}
      ${group.periods.length > 1 ? renderTotals(`Total ${group.vehicleCorporation}`, group.totals) : ''}
    </section>`;
  }).join('');

  return `<!doctype html>
    <html><head><meta charset="utf-8"><title>Monthly-Income_${escapeHtml(formatMonthLabel(month)).replace(/\s+/g, '-')}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm 12mm 12mm; }
        body { color: #000; font: 9pt Arial, sans-serif; }
        h1 { font-size: 14pt; margin: 0 0 3pt; padding: 6pt 8pt; background: #f3f6f3; border-bottom: 1px solid #1f4d2b; }
        h2 { font-size: 12pt; margin: 5pt 0 3pt; }
        h3 { font-size: 10.5pt; margin: 4pt 0 2pt; }
        h4 { font-size: 9.5pt; margin: 3pt 0 2pt; }
        h2 span, h3 span, h4 span { font-size: 8pt; font-weight: normal; }
        p { margin: 0 0 5pt; font-size: 8pt; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { padding: 4pt 4px; border: 1px solid #1f4d2b; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        th { background: #f3f6f3; }
        .income { font-size: 8pt; }
        .income th:nth-child(1) { width: 4%; }
        .income th:nth-child(2) { width: 10%; }
        .income th:nth-child(3), .income th:nth-child(4) { width: 12%; }
        .income th:nth-child(5), .income th:nth-child(6) { width: 10%; }
        .income th:nth-child(7) { width: 11%; }
        .income th:nth-child(8), .income th:nth-child(9) { width: 7%; }
        .income th:nth-child(10) { width: 8%; }
        .income th:nth-child(11) { width: 9%; }
        .number { text-align: right; white-space: nowrap; }
        .totals { margin-top: 4pt; font-size: 8pt; }
        .totals th { width: 25%; }
        .totals td { text-align: right; font-weight: bold; }
        .strong { font-weight: 800 !important; }
        .corporation, .period, .state { margin-bottom: 5pt; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
      </style>
    </head><body>
      <h1>Monthly Income (${escapeHtml(formatMonthLabel(month))})</h1>
      <p>Printed on ${escapeHtml(generatedOn)}</p>
      ${groups}
      ${(income?.groups || []).length > 1 ? renderTotals('Total - all corporations', income.totals, true) : ''}
    </body></html>`;
}
