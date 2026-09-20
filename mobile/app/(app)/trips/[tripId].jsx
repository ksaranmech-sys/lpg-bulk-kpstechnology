import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Card, Muted, Screen } from '../../../src/ui';

export default function TripScreen() {
  const { tripId } = useLocalSearchParams();
  return (
    <Screen>
      <Card title="Trip">
        <Muted>Trip {tripId} — entry forms coming next.</Muted>
      </Card>
    </Screen>
  );
}
