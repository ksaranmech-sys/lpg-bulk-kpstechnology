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
        createdAt: `${month}-04T00:00:00.000Z`,
        dieselRecords: [{ date: `${month}-02T00:00:00.000Z`, litres: 18 }],
      }],
    },
  });
  api.listTripsForVehicle.mockResolvedValue({
    data: {
      trips: [{
        _id: 'trip-1',
        loadingDate: `${month}-01T00:00:00.000Z`,
        unloadingDate: `${month}-03T00:00:00.000Z`,
        turnDate: `${month}-03T00:00:00.000Z`,
        loadingLocation: 'Loading depot',
        unloadingLocation: 'Customer site',
        dieselEntries: [{ volumeLitres: 999 }],
        settlement: { totalDieselLitres: 20 },
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
  expect(container.textContent).toContain('Diesel Verification');
  expect(container.querySelector('#diesel-verification-vehicle').value).toBe('vehicle-1');
  expect(container.querySelector('#diesel-verification-month').type).toBe('month');
  expect(container.querySelector('#diesel-verification-file').accept).toContain('.pdf');
  expect(container.querySelector('#diesel-verification-file').accept).toContain('.xlsx');
  expect(container.querySelector('#diesel-verification-file').accept).toContain('.csv');
  expect(api.listDieselVerifications).toHaveBeenCalled();
  expect(container.textContent).toContain('vendor-statement.xlsx');
  expect(container.textContent).toContain('Loading depot');
  expect(container.textContent).toContain('Customer site');
  expect(container.textContent).toContain('Diesel added in trip');
  expect(container.textContent).toContain('999 L');
  expect(container.textContent).not.toContain('20 L');
  expect(container.textContent).toContain('18 L');

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
