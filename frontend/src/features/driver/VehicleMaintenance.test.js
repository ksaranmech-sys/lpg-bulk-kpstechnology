import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as api from '../../api/api';
import VehicleMaintenance from './VehicleMaintenance';

jest.mock('../../api/api', () => ({
  updateVehicleMaintenance: jest.fn(),
}));
jest.mock('./VehicleTyreDetails', () => () => null);

const vehicle = {
  _id: 'vehicle-1',
  vehicleNumber: 'KA01AB1234',
  lastKnownOdometer: 1100,
  maintenanceComponents: [{
    name: 'Engine Oil',
    startingOdometerKm: 1000,
    expectedKm: 2000,
    reminderKm: 500,
  }],
};

function changeInputValue(input, value) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setValue.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

test('maintenance fields are read-only until edit and save returns to read-only mode', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const updatedVehicle = {
    ...vehicle,
    maintenanceComponents: [{ ...vehicle.maintenanceComponents[0], expectedKm: 2500 }],
  };
  api.updateVehicleMaintenance.mockResolvedValue({ data: { vehicle: updatedVehicle } });
  const onVehicleUpdated = jest.fn();
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => root.render(
    <VehicleMaintenance vehicle={vehicle} onVehicleUpdated={onVehicleUpdated} />
  ));

  const expectedInput = container.querySelector('[aria-label="Engine Oil expected KM"]');
  expect(expectedInput.readOnly).toBe(true);
  expect(container.querySelector('button[type="submit"]')).toBeNull();
  expect(container.textContent).toContain('Edit');

  await act(async () => container.querySelector('button[type="button"]').click());
  expect(expectedInput.readOnly).toBe(false);
  expect(container.querySelector('button[type="submit"]').textContent).toBe('Save');

  await act(async () => {
    changeInputValue(expectedInput, '2500');
  });
  await act(async () => container.querySelector('form').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true })
  ));

  expect(api.updateVehicleMaintenance).toHaveBeenCalledWith('vehicle-1', [{
    name: 'Engine Oil',
    startingOdometerKm: 1000,
    expectedKm: 2500,
    reminderKm: 500,
  }, ...['Gear Oil', 'Clutch Oil', 'Crown Oil', 'Wheel Grease', 'Battery', 'Tyre Powder'].map((name) => ({
    name,
    startingOdometerKm: null,
    expectedKm: null,
    reminderKm: null,
  }))]);
  expect(onVehicleUpdated).toHaveBeenCalledWith(updatedVehicle);
  expect(container.querySelector('[aria-label="Engine Oil expected KM"]').readOnly).toBe(true);
  expect(container.querySelector('button[type="submit"]')).toBeNull();
  expect(container.querySelector('[role="status"]').textContent).toBe('Vehicle maintenance reminders saved.');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

test('cancel discards unsaved maintenance edits', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => root.render(<VehicleMaintenance vehicle={vehicle} />));
  await act(async () => container.querySelector('button[type="button"]').click());
  const expectedInput = container.querySelector('[aria-label="Engine Oil expected KM"]');
  await act(async () => {
    changeInputValue(expectedInput, '2500');
  });
  expect(expectedInput.value).toBe('2500');
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Cancel')
      .click();
  });

  expect(container.querySelector('[aria-label="Engine Oil expected KM"]').value).toBe('2000');
  expect(container.querySelector('[aria-label="Engine Oil expected KM"]').readOnly).toBe(true);
  expect(api.updateVehicleMaintenance).not.toHaveBeenCalled();

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
