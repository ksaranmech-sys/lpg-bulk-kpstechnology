import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import VehicleDriverLeaveSection from './VehicleDriverLeaveSection';

jest.mock('./DriverList', () => ({ embedded }) => (
  <div className={embedded ? '' : 'card'}>Vehicle &amp; Driver List</div>
));

jest.mock('./AdminLeaveSection', () => ({ embedded }) => (
  <div className={embedded ? '' : 'card'}>Leave Entries</div>
));

test('renders driver and leave sections inside one card', () => {
  const markup = renderToStaticMarkup(
    <VehicleDriverLeaveSection
      vehicles={[]}
      driverUsers={[]}
      leaves={[]}
    />
  );
  const container = document.createElement('div');
  container.innerHTML = markup;

  expect(container.querySelectorAll('.card')).toHaveLength(1);
  expect(container.textContent).toContain('Vehicle & Driver List');
  expect(container.textContent).toContain('Leave Entries');
});
