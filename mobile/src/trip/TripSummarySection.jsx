import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { formatDate } from '@kps/shared';
import { Card, Muted, Row } from '../ui';
import { colors, spacing } from '../theme';

const sum = (entries, key = 'amount') => entries.reduce((total, entry) => total + Number(entry[key] || 0), 0);
const dateOrDash = (value) => (value ? formatDate(value) : '-');

// Every photo attached to the trip, in report order, with a short caption.
function collectTripPhotos(trip) {
  const photos = [];
  if (trip.parkingPhoto?.url) photos.push({ url: trip.parkingPhoto.url, caption: `Parking (${dateOrDash(trip.loadingDate)})` });
  (trip.dieselEntries || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `Diesel ${dateOrDash(entry.filledAt)} - Rs ${Number(entry.amount || 0)}` });
  });
  (trip.rtoEntries || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `RTO ${dateOrDash(entry.date)} - Rs ${Number(entry.amount || 0)}` });
  });
  (trip.otherExpenses || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `${entry.description || 'Other'} ${dateOrDash(entry.date)} - Rs ${Number(entry.amount || 0)}` });
  });
  return photos;
}

function formatMileage(km, totalDieselLitres) {
  const distance = Number(km);
  const litres = Number(totalDieselLitres);
  if (!Number.isFinite(distance) || !Number.isFinite(litres) || litres <= 0) return 'NA';
  return `${(distance / litres).toFixed(2)} km/L`;
}

function Block({ title, children }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

// Port of the web EntriesSummary ("Single Trip" card) without the print-only layout.
export default function TripSummarySection({ trip }) {
  const advances = trip.driverAdvances || [];
  const dieselEntries = trip.dieselEntries || [];
  const rtoEntries = trip.rtoEntries || [];
  const otherExpenses = trip.otherExpenses || [];
  const totalAdvance = sum(advances);
  const dieselCardTotal = sum(dieselEntries.filter((entry) => entry.paymentMethod !== 'cash'));
  const dieselCashTotal = sum(dieselEntries.filter((entry) => entry.paymentMethod === 'cash'));
  const totalDiesel = sum(dieselEntries);
  const totalDieselLitres = trip.settlement?.totalDieselLitres != null ? Number(trip.settlement.totalDieselLitres) : null;
  const loadingExpenseTotal = Number(trip.loadingExpense || 0);
  const parkingExpenseTotal = Number(trip.parkingExpense || 0);
  const turnExpenseTotal = Number(trip.turnExpense || 0);
  const totalExpenses = dieselCashTotal + loadingExpenseTotal + parkingExpenseTotal + turnExpenseTotal + sum(rtoEntries) + sum(otherExpenses);
  const balance = totalAdvance - totalExpenses;
  const photos = collectTripPhotos(trip);
  const returnTarget = (trip.isDiverted && trip.divertUnloadingLocation) ? trip.divertUnloadingLocation : (trip.unloadingLocation || '-');

  const route = `${trip.loadingLocation || '-'} (${dateOrDash(trip.loadingDate)}) \u2192 ${trip.unloadingLocation || '-'} (${dateOrDash(trip.unloadingDate)})`
    + (trip.unloadingWeightTons != null && trip.unloadingWeightTons !== '' ? ` - ${trip.unloadingWeightTons} t` : '')
    + (trip.isDiverted ? ` \u2192 ${trip.divertUnloadingLocation || '-'} (${dateOrDash(trip.divertDate)}) - Divert` : '');

  return (
    <Card title="Single Trip" style={styles.card}>
      <Block title="Trip">
        <Row label="Customer" value={trip.customer?.companyName || 'Unknown'} />
        <Row label="Driver" value={trip.driverName || '-'} />
        <Text style={styles.route}>{route}</Text>
      </Block>

      <Block title="Trip KM">
        <Row label="Trip KM" value={trip.odometerKm != null ? `${trip.odometerKm} km` : 'NA'} />
        <Row label="Diesel for Trip" value={totalDieselLitres > 0 ? `${totalDieselLitres} L` : 'NA'} />
        <Row label="Mileage" value={formatMileage(trip.odometerKm, totalDieselLitres)} />
        {trip.manualKm != null && trip.manualKm !== '' && (
          <Row label={`Manual KM Load (${trip.loadingLocation || '-'} \u2192 ${trip.unloadingLocation || '-'})`} value={`${trip.manualKm} km (One Way)`} />
        )}
        {trip.manualKmDivert != null && trip.manualKmDivert !== '' && (
          <Row label={`Manual KM Divert (${trip.unloadingLocation || '-'} \u2192 ${trip.divertUnloadingLocation || '-'})`} value={`${trip.manualKmDivert} km (One Way)`} />
        )}
        {trip.manualKmReturn != null && trip.manualKmReturn !== '' && (
          <Row label={`Manual KM Return (${trip.fillingOrderLocation || '-'} \u2192 ${returnTarget})`} value={`${trip.manualKmReturn} km (One Way)`} />
        )}
        <Row label="Driver KM" value={trip.corporationKm != null ? `${trip.corporationKm} km` : 'NA'} bold />
      </Block>

      <Block title="Driver Advance Details">
        {advances.length === 0 ? <Muted>No driver advances added yet.</Muted> : null}
        {advances.map((advance, index) => (
          <Row key={index} label={dateOrDash(advance.date)} value={`Rs ${Number(advance.amount || 0)}`} />
        ))}
        <Row label="Total" value={`Rs ${totalAdvance}`} bold />
      </Block>

      <Block title="Diesel Filled Details">
        {dieselEntries.length === 0 ? <Muted>No diesel entries added yet.</Muted> : null}
        {dieselEntries.map((entry, index) => (
          <Row
            key={index}
            label={[
              dateOrDash(entry.filledAt),
              entry.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card',
              entry.odometerKm != null ? `Odo ${entry.odometerKm}` : null,
              entry.loadingPointTankFill ? 'Tank Fill' : null,
            ].filter(Boolean).join(' | ')}
            value={`Rs ${Number(entry.amount || 0)}`}
          />
        ))}
        <Row label="Diesel Card" value={`Rs ${dieselCardTotal}`} bold />
        <Row label="Cash" value={`Rs ${dieselCashTotal}`} bold />
        <Row label="Total" value={`Rs ${totalDiesel}`} bold />
      </Block>

      <Block title="Expenses">
        <Row label={`Cleaner Loading (${dateOrDash(trip.loadingDate)})`} value={`Rs ${loadingExpenseTotal}`} />
        <Row label={`Turn (${dateOrDash(trip.loadingDate)})`} value={`Rs ${turnExpenseTotal}`} />
        <Row label={`Parking (${dateOrDash(trip.loadingDate)})`} value={`Rs ${parkingExpenseTotal}`} />
        {rtoEntries.map((entry, index) => (
          <Row key={`rto-${index}`} label={`RTO (${dateOrDash(entry.date)})`} value={`Rs ${Number(entry.amount || 0)}`} />
        ))}
        {otherExpenses.map((entry, index) => (
          <Row key={`other-${index}`} label={`${entry.description || 'Other'} (${dateOrDash(entry.date)})`} value={`Rs ${Number(entry.amount || 0)}`} />
        ))}
        <Row label="Total" value={`Rs ${totalExpenses}`} bold />
      </Block>

      <View style={styles.balance}>
        <View>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Muted>(Driver Advance - Expenses Total)</Muted>
        </View>
        <Text style={styles.balanceValue}>Rs {balance}</Text>
      </View>

      {photos.length > 0 && (
        <View style={[styles.block, { marginTop: spacing.lg, marginBottom: 0 }]}>
          <Text style={styles.blockTitle}>Trip Photos</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <View key={`${photo.url}-${index}`} style={styles.photoCell}>
                <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" />
                <Muted style={styles.photoCaption}>{photo.caption}</Muted>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: '#1f4d2b' },
  block: { marginBottom: spacing.lg },
  blockTitle: { fontSize: 14, fontWeight: '700', color: colors.green900, marginBottom: spacing.xs },
  route: { color: colors.ink, marginTop: spacing.sm, fontSize: 14 },
  balance: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm },
  balanceLabel: { fontSize: 16, fontWeight: '800', color: colors.green900 },
  balanceValue: { fontSize: 18, fontWeight: '800', color: colors.green900 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCell: { width: '48%', borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: 140, backgroundColor: colors.paper },
  photoCaption: { fontSize: 11, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 6 },
});
