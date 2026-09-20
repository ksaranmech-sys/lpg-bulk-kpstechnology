// Single place that knows where the login session lives in the browser. The mobile app will
// provide the same three functions backed by SecureStore instead of localStorage.
const TOKEN_KEY = 'kps_token';
const REFRESH_KEY = 'kps_refresh_token';
const USER_KEY = 'kps_user';

export function getSession() {
  const rawUser = localStorage.getItem(USER_KEY);
  return {
    token: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
    user: rawUser ? JSON.parse(rawUser) : null,
  };
}

export function saveSession({ token, refreshToken, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
