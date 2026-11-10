import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SalaryTripsTable from './SalaryTripsTable';

test('formats diesel litres and amounts to exactly two decimal places', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <SalaryTripsTable
        trips={[{
          _id: 'trip-1',
          previousTripLoadingDate: '2026-11-05T00:00:00.000Z',
          turnDate: '2026-11-10T00:00:00.000Z',
          dieselLitres: 431.01,
          dieselTotal: 42470.979999996,
        }]}
        closingTripId={null}
        onCloseTrip={() => {}}
        totals={{
          corporationKm: 0,
          totalDieselLitres: 431.01,
          totalDiesel: 42470.979999996,
          totalAdvance: 0,
          totalExpense: 0,
          totalBalance: 0,
        }}
      />
    );
  });

  const rows = container.querySelectorAll('tbody tr');
  const tripCells = rows[0].querySelectorAll('td');
  expect(tripCells[1].textContent).toBe(new Date('2026-11-05T00:00:00.000Z').toLocaleDateString('en-IN'));
  expect(tripCells[2].textContent).toBe('-');
  expect(container.querySelectorAll('thead th')[1].textContent).toBe('Loading Turn Date');
  expect(container.querySelectorAll('thead th')[2].textContent).toBe('Loading Location');
  expect(tripCells[8].textContent).toBe('431.01 L');
  expect(tripCells[9].textContent).toBe('Rs 42,470.98');
  expect(rows[1].querySelectorAll('td')[2].textContent).toBe('431.01 L');
  expect(rows[1].querySelectorAll('td')[3].textContent).toBe('Rs 42,470.98');

  await act(async () => root.unmount());
  container.remove();
  global.IS_REACT_ACT_ENVIRONMENT = false;
});
