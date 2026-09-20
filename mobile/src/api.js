import { createApiClient } from '@kps/shared';
import * as Location from 'expo-location';
import { API_BASE_URL } from './config';
import * as session from './session';

// AuthContext registers a listener so a rejected refresh token sends the user to the login screen.
const sessionExpiredListeners = new Set();
export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

export const api = createApiClient({
  baseURL: API_BASE_URL,
  session,
  onSessionExpired: () => sessionExpiredListeners.forEach((listener) => listener()),
});

// Returns a human-readable message from an API error (mirrors err.response?.data?.error on web).
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.message === 'Network Error') return `Cannot reach the server at ${API_BASE_URL}. Check your internet connection.`;
  return fallback;
}

// Mobile counterpart of the web getCurrentPosition(): resolves null if permission is denied.
export async function getCurrentPosition() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err) {
    return null;
  }
}

// Converts an expo-image-picker asset into the { uri, name, type } shape FormData accepts on
// React Native (the shared api client appends it as the photo field).
export function assetToUploadFile(asset) {
  if (!asset) return null;
  const name = asset.fileName || `photo-${Date.now()}.jpg`;
  return { uri: asset.uri, name, type: asset.mimeType || 'image/jpeg' };
}
