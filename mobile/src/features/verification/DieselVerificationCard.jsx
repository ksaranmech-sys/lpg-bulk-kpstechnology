import React from 'react';
import {
  buildDieselVerificationRows,
  formatVerificationAmount,
  formatVerificationDate,
  formatVerificationKilometres,
  formatVerificationLitres,
  formatVerificationMileage,
  getDieselVerificationDateRange,
} from '@kps/shared';
import { api } from '../../api';
import VerificationCard from './VerificationCard';

const config = {
  title: 'Diesel Verification & DEF',
  vehicleDescription: 'diesel verification',
  description: 'Upload the monthly Diesel / DEF statement and compare it with trip records for the selected salary month.',
  comparisonDescription: 'Diesel statement quantities are matched to each trip from the previous Load Turn through the day before this trip’s Load Turn.',
  endpoint: 'diesel-verifications',
  listUploads: api.listDieselVerifications,
  createUpload: api.createDieselVerification,
  downloadUpload: api.downloadDieselVerificationFile,
  deleteUpload: api.deleteDieselVerification,
  getDateRange: getDieselVerificationDateRange,
  buildRows: buildDieselVerificationRows,
  formatDate: formatVerificationDate,
  uploadSuccess: 'Monthly fuel statement uploaded.',
  loadError: 'Failed to load diesel verification data.',
  uploadError: 'Failed to upload diesel statement.',
  downloadError: 'Failed to download diesel statement.',
  deleteError: 'Failed to delete diesel statement.',
  deleteSuccess: 'Diesel statement deleted.',
  columns: [
    { key: 'sNo', label: 'S.No', width: 52, value: (_, index) => index + 1 },
    { key: 'previousLoadTurnDate', label: 'Load Turn', width: 96, value: (row) => formatVerificationDate(row.previousLoadTurnDate) },
    { key: 'loading', label: 'Loading', width: 110, value: (row) => row.loading || '—' },
    { key: 'unloading', label: 'Unloading Location', width: 128, value: (row) => row.unloading || '—' },
    { key: 'unloadingDate', label: 'Unloading', width: 96, value: (row) => formatVerificationDate(row.unloadingDate) },
    { key: 'tripKm', label: 'Odometer KM', width: 100, value: (row) => formatVerificationKilometres(row.tripKm) },
    { key: 'mileageKmPerLitre', label: 'Mileage', width: 82, value: (row) => formatVerificationMileage(row.mileageKmPerLitre) },
    { key: 'dieselForTrip', label: 'Diesel (Trip)', width: 96, value: (row) => formatVerificationLitres(row.dieselForTrip) },
    { key: 'tripDiesel', label: 'Diesel (Filled)', width: 100, value: (row) => formatVerificationLitres(row.tripDiesel) },
    { key: 'dieselFromDocument', label: 'Diesel (Document)', width: 118, value: (row) => formatVerificationLitres(row.dieselFromDocument) },
    { key: 'defAmountFromDocument', label: 'DEF (Document)', width: 112, value: (row) => formatVerificationAmount(row.defAmountFromDocument) },
  ],
};

export default function DieselVerificationCard({ vehicles, loading }) {
  return <VerificationCard vehicles={vehicles} loading={loading} config={config} />;
}
