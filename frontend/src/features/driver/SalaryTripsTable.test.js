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
  expect(rows[0].querySelectorAll('td')[7].textContent).toBe('431.01 L');
  expect(rows[0].querySelectorAll('td')[8].textContent).toBe('Rs 42,470.98');
  expect(rows[1].querySelectorAll('td')[2].textContent).toBe('431.01 L');
  expect(rows[1].querySelectorAll('td')[3].textContent).toBe('Rs 42,470.98');

  await act(async () => root.unmount());
  container.remove();
  global.IS_REACT_ACT_ENVIRONMENT = false;
});
