import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { currentMonth, formatMonthLabel, monthKey } from '@kps/shared';
import { api, errorMessage } from '../../api';
import * as session from '../../session';
import { Button, Card, ErrorText, Loading, Muted, Select } from '../../ui';
import { colors, spacing } from '../../theme';

const MONTH_COUNT = 36;
const FILE_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

function selectableMonths(today = new Date()) {
  return Array.from({ length: MONTH_COUNT }, (_, index) => (
    monthKey(new Date(today.getFullYear(), today.getMonth() - index, 1))
  ));
}

function fileType(name, mimeType) {
  if (mimeType) return mimeType;
  const extension = String(name || '').split('.').pop().toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'xls') return 'application/vnd.ms-excel';
  if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (extension === 'csv') return 'text/csv';
  return 'application/octet-stream';
}

function totalTableWidth(columns) {
  return columns.reduce((total, column) => total + column.width, 0);
}

export default function VerificationCard({ vehicles, loading: vehiclesLoading, config }) {
  const months = useMemo(() => selectableMonths(), []);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [file, setFile] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [comparisonUploads, setComparisonUploads] = useState([]);
  const [trips, setTrips] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const vehicleId = selectedVehicleId && vehicles.some((vehicle) => String(vehicle._id) === selectedVehicleId)
    ? selectedVehicleId
    : String(vehicles[0]?._id || '');
  const selectedVehicle = vehicles.find((vehicle) => String(vehicle._id) === vehicleId);

  useEffect(() => {
    setSelectedVehicleId((currentId) => (
      vehicles.some((vehicle) => String(vehicle._id) === String(currentId))
        ? currentId
        : String(vehicles[0]?._id || '')
    ));
  }, [vehicles]);

  useEffect(() => {
    if (!vehicleId || !month) {
      setUploads([]);
      setComparisonUploads([]);
      setTrips([]);
      setDataLoading(false);
      return undefined;
    }

    let active = true;
    setDataLoading(true);
    setError('');
    setUploads([]);
    setComparisonUploads([]);
    setTrips([]);

    async function loadData() {
      try {
        const [uploadResponse, tripResponse] = await Promise.all([
          config.listUploads({ vehicleId, month }),
          api.listTripsForVehicle(vehicleId),
        ]);
        const monthUploads = uploadResponse.data.uploads || [];
        const nextTrips = tripResponse.data.trips || [];
        const dateRange = config.getDateRange(
          nextTrips,
          month,
          monthUploads,
          selectedVehicle?.vehicleNumber || '',
          selectedVehicle?.driverMobile || ''
        );
        let nextComparisonUploads = monthUploads;
        if (dateRange) {
          const comparisonResponse = await config.listUploads({ vehicleId, ...dateRange });
          const uploadsById = new Map(
            [...monthUploads, ...(comparisonResponse.data.uploads || [])]
              .map((upload) => [upload._id, upload])
          );
          nextComparisonUploads = [...uploadsById.values()];
        }
        if (active) {
          setUploads(monthUploads);
          setComparisonUploads(nextComparisonUploads);
          setTrips(nextTrips);
        }
      } catch (requestError) {
        if (active) setError(errorMessage(requestError, config.loadError));
      } finally {
        if (active) setDataLoading(false);
      }
    }

    loadData();
    return () => { active = false; };
  }, [config, month, refreshKey, selectedVehicle?.driverMobile, selectedVehicle?.vehicleNumber, vehicleId]);

  const rows = useMemo(() => config.buildRows(
    trips,
    month,
    comparisonUploads,
    selectedVehicle?.vehicleNumber || '',
    selectedVehicle?.driverMobile || ''
  ), [comparisonUploads, config, month, selectedVehicle?.driverMobile, selectedVehicle?.vehicleNumber, trips]);

  async function pickStatement() {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uploadFile = Platform.OS === 'web'
        ? asset.file
        : {
          uri: asset.uri,
          name: asset.name || 'monthly-statement',
          type: fileType(asset.name, asset.mimeType),
        };
      if (!uploadFile) throw new Error('The selected statement could not be opened.');
      setFile(uploadFile);
      setMessage('');
    } catch (pickerError) {
      setError(errorMessage(pickerError, 'Failed to select a statement file'));
    }
  }

  async function uploadStatement() {
    if (!file || !vehicleId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await config.createUpload({ vehicleId, month }, file);
      setFile(null);
      setMessage(config.uploadSuccess);
      setRefreshKey((current) => current + 1);
    } catch (uploadError) {
      setError(errorMessage(uploadError, config.uploadError));
    } finally {
      setSaving(false);
    }
  }

  async function downloadUpload(upload) {
    setDownloadingId(upload._id);
    setError('');
    try {
      if (Platform.OS === 'web') {
        const response = await config.downloadUpload(upload._id);
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = upload.originalName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      if (!FileSystem.cacheDirectory) throw new Error('File downloads are unavailable on this device.');
      const { token } = await session.getSession();
      if (!token) throw new Error('Your session has expired. Sign in again to download this statement.');
      const safeName = String(upload.originalName || 'statement').replace(/[\\/:*?"<>|]/g, '_');
      const localUri = `${FileSystem.cacheDirectory}${upload._id}-${safeName}`;
      const response = await FileSystem.downloadAsync(
        api.http.getUri({ url: `/${config.endpoint}/${upload._id}/file` }),
        localUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.status < 200 || response.status >= 300) {
        throw new Error('Failed to download the statement file.');
      }
      if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
      await Sharing.shareAsync(response.uri, {
        mimeType: fileType(upload.originalName, upload.mimeType),
        dialogTitle: upload.originalName,
      });
    } catch (downloadError) {
      setError(errorMessage(downloadError, config.downloadError));
    } finally {
      setDownloadingId('');
    }
  }

  async function deleteUpload(upload) {
    setDeletingId(upload._id);
    setError('');
    setMessage('');
    try {
      await config.deleteUpload(upload._id);
      setUploads((current) => current.filter((entry) => entry._id !== upload._id));
      setComparisonUploads((current) => current.filter((entry) => entry._id !== upload._id));
      setMessage(config.deleteSuccess);
    } catch (deleteError) {
      setError(errorMessage(deleteError, config.deleteError));
    } finally {
      setDeletingId('');
    }
  }

  function confirmDelete(upload) {
    Alert.alert(
      'Delete statement?',
      `Delete "${upload.originalName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteUpload(upload) },
      ]
    );
  }

  const tableWidth = totalTableWidth(config.columns);

  return (
    <Card title={config.title}>
      <Muted style={{ marginBottom: spacing.md }}>{config.description}</Muted>
      {vehiclesLoading ? <Loading text="Loading vehicles..." /> : vehicles.length === 0 ? (
        <Muted>No vehicles available for {config.vehicleDescription}.</Muted>
      ) : (
        <>
          <Select
            label="Select Vehicle"
            value={vehicleId}
            options={vehicles.map((vehicle) => ({
              value: String(vehicle._id),
              label: `${vehicle.vehicleNumber}${vehicle.driverName ? ` | ${vehicle.driverName}` : ''}`,
            }))}
            onChange={(value) => {
              setSelectedVehicleId(value);
              setFile(null);
              setMessage('');
              setError('');
            }}
            placeholder="Select vehicle"
            dropdown
          />
          <Select
            label="Report Month"
            value={month}
            options={months.map((key) => ({ value: key, label: formatMonthLabel(key) }))}
            onChange={(value) => {
              if (!value) return;
              setMonth(value);
              setFile(null);
              setMessage('');
              setError('');
            }}
            placeholder="Select month"
            dropdown
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
            <Button title="Choose Statement" variant="secondary" onPress={pickStatement} disabled={saving} />
            {file ? (
              <>
                <Muted style={{ flexBasis: '100%' }}>{file.name}</Muted>
                <Button title="Remove File" variant="secondary" onPress={() => setFile(null)} disabled={saving} />
              </>
            ) : null}
            <Button
              title="Upload Statement"
              onPress={uploadStatement}
              loading={saving}
              disabled={!file || dataLoading}
            />
          </View>
          <ErrorText>{error}</ErrorText>
          {message ? <Muted style={{ color: colors.success, marginBottom: spacing.sm }}>{message}</Muted> : null}

          <Text style={{ color: colors.ink, fontWeight: '700', marginBottom: spacing.sm }}>
            Customer statements — {month}
          </Text>
          {uploads.length === 0 ? (
            <Muted style={{ marginBottom: spacing.md }}>
              No statements uploaded for {selectedVehicle?.vehicleNumber} in this month.
            </Muted>
          ) : uploads.map((upload) => (
            <View key={upload._id} style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border }}>
              <Muted style={{ marginBottom: spacing.xs }}>
                {upload.originalName} · {config.formatDate(upload.createdAt)}
              </Muted>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={downloadingId === upload._id ? 'Downloading...' : 'Download'}
                  variant="secondary"
                  onPress={() => downloadUpload(upload)}
                  disabled={Boolean(downloadingId || deletingId)}
                  style={{ flex: 1, minHeight: 38, paddingVertical: 8 }}
                  textStyle={{ fontSize: 13 }}
                />
                <Button
                  title={deletingId === upload._id ? 'Deleting...' : 'Delete'}
                  variant="secondary"
                  onPress={() => confirmDelete(upload)}
                  disabled={Boolean(downloadingId || deletingId)}
                  style={{ flex: 1, minHeight: 38, paddingVertical: 8 }}
                  textStyle={{ fontSize: 13 }}
                />
              </View>
            </View>
          ))}

          <Text style={{ color: colors.ink, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.xs }}>
            Trip comparison — {selectedVehicle?.vehicleNumber}
          </Text>
          <Muted style={{ marginBottom: spacing.sm }}>{config.comparisonDescription}</Muted>
          {dataLoading ? <Loading text="Loading trips and statements..." /> : rows.length === 0 ? (
            <Muted>No trips found for this vehicle in {formatMonthLabel(month)}.</Muted>
          ) : (
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
              <View style={{ width: tableWidth, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#e8f1eb' }}>
                  {config.columns.map((column) => (
                    <View key={column.key} style={{ width: column.width, padding: 8, borderRightWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.ink, fontSize: 11, fontWeight: '700' }}>{column.label}</Text>
                    </View>
                  ))}
                </View>
                {rows.map((row, index) => (
                  <View key={row.id} style={{ flexDirection: 'row', backgroundColor: index % 2 ? '#f7fafc' : '#fff' }}>
                    {config.columns.map((column) => (
                      <View key={column.key} style={{ width: column.width, minHeight: 40, justifyContent: 'center', padding: 8, borderTopWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.ink, fontSize: 11 }}>{column.value(row, index + 1)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </>
      )}
    </Card>
  );
}
