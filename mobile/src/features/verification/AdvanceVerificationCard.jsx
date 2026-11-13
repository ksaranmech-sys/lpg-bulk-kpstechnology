import React from 'react';
import {
  buildAdvanceVerificationRows,
  formatAdvanceVerificationAmount,
  getAdvanceVerificationDateRange,
  formatVerificationDate,
} from '@kps/shared';
import { api } from '../../api';
import VerificationCard from './VerificationCard';

const config = {
  title: 'Advance Verification',
  vehicleDescription: 'advance verification',
  description: 'Upload the monthly advance statement and compare it with advances recorded on trips for the selected salary month.',
  comparisonDescription: 'Statement advances are matched to trips from the previous Load Turn through the day before this trip’s Load Turn.',
  endpoint: 'advance-verifications',
  listUploads: api.listAdvanceVerifications,
  createUpload: api.createAdvanceVerification,
  downloadUpload: api.downloadAdvanceVerificationFile,
  deleteUpload: api.deleteAdvanceVerification,
  getDateRange: getAdvanceVerificationDateRange,
  buildRows: buildAdvanceVerificationRows,
  formatDate: formatVerificationDate,
  uploadSuccess: 'Monthly advance statement uploaded.',
  loadError: 'Failed to load advance verification data.',
  uploadError: 'Failed to upload advance statement.',
  downloadError: 'Failed to download advance statement.',
  deleteError: 'Failed to delete advance statement.',
  deleteSuccess: 'Advance statement deleted.',
  columns: [
    { key: 'sNo', label: 'S.No', width: 52, value: (_, index) => index + 1 },
    { key: 'previousLoadTurnDate', label: 'Load Turn', width: 100, value: (row) => formatVerificationDate(row.previousLoadTurnDate) },
    { key: 'loading', label: 'Loading', width: 112, value: (row) => row.loading || '—' },
    { key: 'unloading', label: 'Unloading', width: 112, value: (row) => row.unloading || '—' },
    { key: 'unloadingDate', label: 'Unloading Date', width: 100, value: (row) => formatVerificationDate(row.unloadingDate) },
    { key: 'advancesAdded', label: 'Advance (Driver)', width: 122, value: (row) => formatAdvanceVerificationAmount(row.advancesAdded) },
    { key: 'advanceFromDocument', label: 'Advance (Bank)', width: 122, value: (row) => formatAdvanceVerificationAmount(row.advanceFromDocument) },
  ],
};

export default function AdvanceVerificationCard({ vehicles, loading }) {
  return <VerificationCard vehicles={vehicles} loading={loading} config={config} />;
}
