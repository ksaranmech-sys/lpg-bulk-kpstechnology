import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { formatDateLong } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { useTrip } from '../../../src/trip/useTrip';
import { Badge, Button, ErrorText, Loading, Muted, Screen } from '../../../src/ui';
import { colors, spacing } from '../../../src/theme';
import AdvanceSection from '../../../src/trip/AdvanceSection';
import LoadingSection from '../../../src/trip/LoadingSection';
import DieselSection from '../../../src/trip/DieselSection';
import RtoSection from '../../../src/trip/RtoSection';
import UnloadingTurnSection from '../../../src/trip/UnloadingTurnSection';
import UnloadingSection from '../../../src/trip/UnloadingSection';
import OtherExpenseSection from '../../../src/trip/OtherExpenseSection';
import TurnCloseSection from '../../../src/trip/TurnCloseSection';
import TripSummarySection from '../../../src/trip/TripSummarySection';

export default function TripScreen() {
  const { tripId } = useLocalSearchParams();
  const { user } = useAuth();
  const { trip, meta, loading, error, reload } = useTrip(tripId);
  // After an entry is added the screen scrolls to the next section so the driver keeps moving
  // down the form (Advance -> Loading -> Diesel -> ...).
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const onSectionLayout = (key) => (event) => { sectionY.current[key] = event.nativeEvent.layout.y; };
  const addedThenGoTo = (nextKey) => async () => {
    await reload();
    // Wait one frame so the reloaded trip's layout is measured before scrolling.
    requestAnimationFrame(() => {
      const y = sectionY.current[nextKey];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
    });
  };

  if (loading || !trip) {
    return (
      <>
        <Stack.Screen options={{ title: 'Trip' }} />
        {error ? (
          <Screen>
            <ErrorText>{error}</ErrorText>
            <Button title="Retry" variant="secondary" onPress={reload} />
          </Screen>
        ) : <Loading />}
      </>
    );
  }

  // The driver can no longer edit a trip they've already Trip Closed - only admins can adjust it.
  const lockedForDriver = user?.role === 'vehicle_user' && trip.status !== 'open';
  const withDate = (value) => (value ? ` (${formatDateLong(value)})` : '');
  const heading = `${trip.loadingLocation || 'Loading pending'}${withDate(trip.loadingDate)} \u2192 `
    + `${trip.unloadingLocation || '(unloading pending)'}${withDate(trip.unloadingDate)}`
    + (trip.isDiverted && trip.divertUnloadingLocation ? ` \u2192 ${trip.divertUnloadingLocation}${withDate(trip.divertDate)} - Divert` : '');
  const sectionProps = { trip, meta, reload, locked: lockedForDriver };

  return (
    <Screen scrollRef={scrollRef}>
      <Stack.Screen options={{ title: trip.vehicle?.vehicleNumber || 'Trip' }} />
      <View style={styles.header}>
        <Text style={styles.heading}>{heading}</Text>
        <Badge status={trip.status} />
      </View>
      <Muted style={styles.meta}>
        Customer: {trip.customer?.companyName || 'Unknown'}{trip.driverName ? `  |  Driver: ${trip.driverName}` : ''}
      </Muted>
      {lockedForDriver && (
        <Muted style={styles.lockedNote}>This trip is closed. Contact your admin to make changes.</Muted>
      )}
      <ErrorText>{error}</ErrorText>

      <View onLayout={onSectionLayout('advance')}><AdvanceSection {...sectionProps} onAdded={addedThenGoTo('loading')} /></View>
      <View onLayout={onSectionLayout('loading')}><LoadingSection {...sectionProps} onAdded={addedThenGoTo('diesel')} /></View>
      <View onLayout={onSectionLayout('diesel')}><DieselSection {...sectionProps} onAdded={addedThenGoTo('rto')} /></View>
      <View onLayout={onSectionLayout('rto')}><RtoSection {...sectionProps} onAdded={addedThenGoTo('unloadingTurn')} /></View>
      <View onLayout={onSectionLayout('unloadingTurn')}><UnloadingTurnSection {...sectionProps} onAdded={addedThenGoTo('unloading')} /></View>
      <View onLayout={onSectionLayout('unloading')}><UnloadingSection {...sectionProps} onAdded={addedThenGoTo('other')} /></View>
      <View onLayout={onSectionLayout('other')}><OtherExpenseSection {...sectionProps} onAdded={addedThenGoTo('turn')} /></View>
      <View onLayout={onSectionLayout('turn')}><TurnCloseSection {...sectionProps} /></View>
      <TripSummarySection trip={trip} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xs },
  heading: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.green900 },
  meta: { marginBottom: spacing.md },
  lockedNote: { marginBottom: spacing.md, color: colors.warning, fontWeight: '600' },
});
