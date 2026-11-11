import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as api from '../../api/api';
import AdvanceVerificationSection from './AdvanceVerificationSection';

jest.mock('../../api/api', () => ({
  listAdvanceVerifications: jest.fn().mockResolvedValue({ data: { uploads: [] } }),
  listTripsForVehicle: jest.fn().mockResolvedValue({ data: { trips: [] } }),
  createAdvanceVerification: jest.fn(),
  downloadAdvanceVerificationFile: jest.fn(),
  deleteAdvanceVerification: jest.fn(),
}));

test('offers vehicle/month statement upload and compares advances with the statement', async () => {
  window.IS_REACT_ACT_ENVIRONMENT = true;
  const date = new Date();
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  api.listAdvanceVerifications.mockResolvedValue({
    data: {
      uploads: [{
        _id: 'advance-upload-1',
        originalName: 'advance-statement.xlsx',
        defaultVehicleNumber: 'KA01AB1234',
        createdAt: `${month}-04T00:00:00.000Z`,
        advanceRecords: [{ date: `${month}-02T00:00:00.000Z`, amount: 1250 }],
      }],
    },
  });
  api.listTripsForVehicle.mockResolvedValue({
    data: {
      trips: [{
        _id: 'previous-trip',
        loadingDate: `${month}-01T00:00:00.000Z`,
        turnDate: `${month}-01T00:00:00.000Z`,
      }, {
        _id: 'trip-1',
        loadingDate: `${month}-02T00:00:00.000Z`,
        unloadingDate: `${month}-03T00:00:00.000Z`,
        turnDate: `${month}-03T00:00:00.000Z`,
        loadingLocation: 'Loading depot',
        unloadingLocation: 'Customer site',
        driverAdvances: [{ amount: 1500 }],
      }],
    },
  });
  const vehicles = [{ _id: 'vehicle-1', vehicleNumber: 'KA01AB1234', driverMobile: '9876543210' }];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<AdvanceVerificationSection vehicles={vehicles} loading={false} />);
  });
  expect(container.textContent).toContain('Advance Verification');
  expect(container.querySelector('#advance-verification-vehicle').value).toBe('vehicle-1');
  expect(container.querySelector('#advance-verification-month').type).toBe('month');
  expect(container.querySelector('#advance-verification-file').accept).toContain('.pdf');
  expect(container.querySelector('#advance-verification-file').accept).toContain('.xls');
  expect(container.querySelector('#advance-verification-file').accept).toContain('.xlsx');
  expect(container.querySelector('#advance-verification-file').accept).toContain('.csv');
  expect(api.listAdvanceVerifications).toHaveBeenCalledWith({ vehicleId: 'vehicle-1', month });
  expect(api.listAdvanceVerifications).toHaveBeenCalledWith({
    vehicleId: 'vehicle-1',
    fromDate: `${month}-01`,
    toDate: `${month}-02`,
  });
  expect(container.textContent).toContain('advance-statement.xlsx');
  const advanceHeaders = Array.from(container.querySelectorAll('thead th')).map((header) => header.textContent);
  expect(advanceHeaders.slice(0, 3)).toEqual(['S.No', 'Load Turn Date', 'Loading']);
  expect(container.textContent).toContain(
    new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-IN', { timeZone: 'UTC' })
  );
  expect(container.textContent).toContain('Loading depot');
  expect(container.textContent).toContain('Customer site');
  expect(container.textContent).toContain('₹1,500');
  expect(container.textContent).toContain('₹1,250');

  await act(async () => root.unmount());
  delete window.IS_REACT_ACT_ENVIRONMENT;
});
