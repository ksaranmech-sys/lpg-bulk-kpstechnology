import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as api from '../../api/api';
import DieselVerificationSection from './DieselVerificationSection';

jest.mock('../../api/api', () => ({
  listDieselVerifications: jest.fn().mockResolvedValue({ data: { uploads: [] } }),
  listTripsForVehicle: jest.fn().mockResolvedValue({ data: { trips: [] } }),
  createDieselVerification: jest.fn(),
  downloadDieselVerificationFile: jest.fn(),
  deleteDieselVerification: jest.fn(),
}));

test('offers vehicle and monthly file selection for diesel verification', async () => {
  window.IS_REACT_ACT_ENVIRONMENT = true;
  const date = new Date();
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  api.listDieselVerifications.mockResolvedValue({
    data: {
      uploads: [{
        _id: 'upload-1',
        originalName: 'vendor-statement.xlsx',
        defaultVehicleNumber: 'KA01AB1234',
        createdAt: `${month}-04T00:00:00.000Z`,
        dieselRecords: [{ date: `${month}-02T00:00:00.000Z`, litres: 18 }],
      }],
    },
  });
  api.listTripsForVehicle.mockResolvedValue({
    data: {
      trips: [{
        _id: 'previous-trip',
        createdAt: `${month}-01T00:00:00.000Z`,
        loadingDate: `${month}-01T00:00:00.000Z`,
        turnDate: `${month}-01T00:00:00.000Z`,
      }, {
        _id: 'trip-1',
        createdAt: `${month}-02T00:00:00.000Z`,
        loadingDate: `${month}-01T00:00:00.000Z`,
        unloadingDate: `${month}-03T00:00:00.000Z`,
        turnDate: `${month}-03T00:00:00.000Z`,
        loadingLocation: 'Loading depot',
        loadingWeightTons: 17.5,
        unloadingLocation: 'Customer site',
        dieselEntries: [{ volumeLitres: 999 }],
        settlement: { totalDieselLitres: 20, totalKm: 850, mileageKmPerLitre: 2.45 },
      }],
    },
  });
  const vehicles = [
    { _id: 'vehicle-1', vehicleNumber: 'KA01AB1234' },
    { _id: 'vehicle-2', vehicleNumber: 'KA02CD5678' },
  ];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<DieselVerificationSection vehicles={vehicles} loading={false} />);
  });
  expect(container.textContent).toContain('Diesel Verification & DEF');
  expect(container.querySelector('#diesel-verification-vehicle').value).toBe('vehicle-1');
  expect(container.querySelector('#diesel-verification-month').type).toBe('month');
  expect(container.querySelector('#diesel-verification-file').accept).toContain('.pdf');
  expect(container.querySelector('#diesel-verification-file').accept).toContain('.xls');
  expect(container.querySelector('#diesel-verification-file').accept).toContain('.xlsx');
  expect(container.querySelector('#diesel-verification-file').accept).toContain('.csv');
  expect(api.listDieselVerifications).toHaveBeenCalled();
  expect(api.listDieselVerifications).toHaveBeenCalledWith({
    vehicleId: 'vehicle-1',
    fromDate: `${month}-01`,
    toDate: `${month}-02`,
  });
  expect(container.textContent).toContain('vendor-statement.xlsx');
  const dieselHeaders = Array.from(container.querySelectorAll('thead th')).map((header) => header.textContent);
  expect(dieselHeaders).toEqual([
    'S.No',
    'Load Turn',
    'Loading',
    'Unloading Location',
    'Unloading',
    'Odometer KM',
    'Mileage',
    'Diesel(Trip)',
    'Diesel(Filled)',
    'Diesel(Document)',
    'DEF(Document)',
  ]);
  expect(container.textContent).not.toContain('Load Weight (tons)');
  expect(container.textContent).toContain(
    new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-IN', { timeZone: 'UTC' })
  );
  expect(container.textContent).toContain('Loading depot');
  expect(container.textContent).toContain('Customer site');
  expect(container.textContent).not.toContain('Diesel added in trip');
  expect(container.textContent).toContain('Odometer KM');
  expect(container.textContent).not.toContain('Trip KM');
  expect(container.textContent).toContain('850 km');
  expect(container.textContent).toContain('2.45 km/L');
  expect(container.textContent).toContain('20 L');
  expect(container.textContent).toContain('999 L');
  expect(container.textContent).toContain('18 L');
  expect(container.textContent).not.toContain('DEF for Trip');
  expect(container.textContent).not.toContain('DEF added in trip');
  expect(container.querySelector('.verification-comparison-scroll')).not.toBeNull();
  expect(container.querySelector('table.diesel-comparison-table')).not.toBeNull();

  const deleteButton = container.querySelector('button[aria-label="Delete vendor-statement.xlsx"]');
  expect(deleteButton).not.toBeNull();
  window.confirm = jest.fn().mockReturnValue(false);
  await act(async () => deleteButton.click());
  expect(window.confirm).toHaveBeenCalledWith(
    'Delete "vendor-statement.xlsx"? This cannot be undone.'
  );
  expect(api.deleteDieselVerification).not.toHaveBeenCalled();

  window.confirm.mockReturnValue(true);
  api.deleteDieselVerification.mockResolvedValue({ data: { message: 'Diesel verification file deleted' } });
  await act(async () => deleteButton.click());
  expect(api.deleteDieselVerification).toHaveBeenCalledWith('upload-1');
  expect(container.textContent).not.toContain('vendor-statement.xlsx');

  const fileInput = container.querySelector('#diesel-verification-file');
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [new File(['csv'], 'diesel.csv', { type: 'text/csv' })],
  });
  await act(async () => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
  const removeSelectedFileButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === 'Remove selected file');
  expect(removeSelectedFileButton).not.toBeUndefined();
  await act(async () => removeSelectedFileButton.click());
  expect(Array.from(container.querySelectorAll('button'))
    .some((button) => button.textContent === 'Remove selected file')).toBe(false);
  expect(fileInput.value).toBe('');

  await act(async () => root.unmount());
  delete window.confirm;
  delete window.IS_REACT_ACT_ENVIRONMENT;
});

test('refreshes trip diesel automatically and when the page regains focus', async () => {
  window.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  const date = new Date();
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const tripFor = (litres) => ({
    _id: 'trip-live',
    status: 'closed',
    loadingDate: `${month}-01T00:00:00.000Z`,
    unloadingDate: `${month}-03T00:00:00.000Z`,
    dieselEntries: [{ volumeLitres: litres }],
  });
  api.listDieselVerifications.mockResolvedValue({ data: { uploads: [] } });
  api.listTripsForVehicle.mockResolvedValue({ data: { trips: [tripFor(10)] } });

  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(
      <DieselVerificationSection vehicles={[{ _id: 'vehicle-1', vehicleNumber: 'KA01AB1234' }]} loading={false} />
    ));
    expect(container.textContent).toContain('10 L');

    api.listTripsForVehicle.mockResolvedValue({ data: { trips: [tripFor(42)] } });
    api.listTripsForVehicle.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.listTripsForVehicle).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('42 L');

    api.listTripsForVehicle.mockResolvedValue({ data: { trips: [tripFor(55)] } });
    api.listTripsForVehicle.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.listTripsForVehicle).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('55 L');
  } finally {
    await act(async () => root.unmount());
    jest.useRealTimers();
    delete window.IS_REACT_ACT_ENVIRONMENT;
  }
});
