/* global globalThis */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as api from '../../api/api';
import VehicleWarrantyDetails from './VehicleWarrantyDetails';

jest.mock('../../api/api', () => ({
  updateVehicleWarranties: jest.fn(),
}));

const vehicle = {
  _id: 'vehicle-1',
  vehicleNumber: 'KA01AB1234',
  warrantyDetails: [{
    name: 'Engine',
    installationDate: '2025-01-15',
    warrantyPeriod: '2 years',
    odometerReading: 12000,
  }],
};

function changeInputValue(input, value) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setValue.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

test('adds and deletes warranty rows and saves the remaining details', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const updatedVehicle = {
    ...vehicle,
    warrantyDetails: [{
      name: 'Alternator',
      installationDate: '2025-03-10',
      warrantyPeriod: '18 months',
      odometerReading: 14500,
    }],
  };
  api.updateVehicleWarranties.mockResolvedValue({ data: { vehicle: updatedVehicle } });
  const onVehicleUpdated = jest.fn();
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => root.render(
    <VehicleWarrantyDetails vehicle={vehicle} onVehicleUpdated={onVehicleUpdated} />
  ));
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Edit')
      .click();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Add component')
      .click();
  });
  expect(container.querySelector('[aria-label="Warranty name 2"]')).not.toBeNull();

  await act(async () => {
    changeInputValue(container.querySelector('[aria-label="Warranty name 2"]'), 'Alternator');
    changeInputValue(container.querySelector('[aria-label="Warranty installation date 2"]'), '2025-03-10');
    changeInputValue(container.querySelector('[aria-label="Warranty period 2"]'), '18 months');
    changeInputValue(container.querySelector('[aria-label="Warranty odometer reading 2"]'), '14500');
  });
  await act(async () => container.querySelector('[aria-label="Delete warranty component 1"]').click());
  expect(container.querySelector('[aria-label="Warranty name 1"]').value).toBe('Alternator');

  await act(async () => container.querySelector('form').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true })
  ));
  expect(api.updateVehicleWarranties).toHaveBeenCalledWith('vehicle-1', [{
    name: 'Alternator',
    installationDate: '2025-03-10',
    warrantyPeriod: '18 months',
    odometerReading: 14500,
  }]);
  expect(onVehicleUpdated).toHaveBeenCalledWith(updatedVehicle);
  expect(container.querySelector('[role="status"]').textContent).toBe('Warranty details saved.');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
