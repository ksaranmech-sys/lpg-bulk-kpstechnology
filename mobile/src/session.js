import * as SecureStore from 'expo-secure-store';

// Mobile counterpart of frontend/src/api/session.js, backed by the device keychain/keystore.
const TOKEN_KEY = 'kps_token';
const REFRESH_KEY = 'kps_refresh_token';
const USER_KEY = 'kps_user';

export async function getSession() {
  const [token, refreshToken, rawUser] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  return { token, refreshToken, user: rawUser ? JSON.parse(rawUser) : null };
}

export async function saveSession({ token, refreshToken, user }) {
  const writes = [];
  if (token) writes.push(SecureStore.setItemAsync(TOKEN_KEY, token));
  if (refreshToken) writes.push(SecureStore.setItemAsync(REFRESH_KEY, refreshToken));
  if (user) writes.push(SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)));
  await Promise.all(writes);
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}
