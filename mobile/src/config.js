import Constants from 'expo-constants';

// Where the app talks to. Resolution order:
//  1. EXPO_PUBLIC_API_BASE_URL from mobile/.env (explicit override)
//  2. In development (Expo Go / dev client): the PC running Metro, on the backend's port 5001,
//     so a phone on the same Wi-Fi reaches your local backend with no configuration.
//  3. Production: the hosted API from app.json "extra.apiBaseUrl".
function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) return process.env.EXPO_PUBLIC_API_BASE_URL;
  const hostUri = Constants.expoConfig?.hostUri;
  if (__DEV__ && hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:5001/api/v1`;
  }
  return Constants.expoConfig?.extra?.apiBaseUrl;
}

export const API_BASE_URL = resolveApiBaseUrl();
