import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api';

const EMPTY_META = { loadingLocations: [], unloadingLocations: [], routeKmTable: [] };

export function useTrip(tripId) {
  const [trip, setTrip] = useState(null);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const res = await api.getTrip(tripId);
      setTrip(res.data.trip);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Unable to load this trip.'));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  // Location lists / KM table change rarely - fetch once per screen visit, not after every save.
  useEffect(() => {
    let active = true;
    api.getMeta()
      .then((res) => { if (active) setMeta({ ...EMPTY_META, ...res.data }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return { trip, meta, loading, error, reload };
}
