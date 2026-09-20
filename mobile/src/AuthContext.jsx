import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, onSessionExpired } from './api';
import { getSession, saveSession, clearSession } from './session';

const AuthContext = createContext(null);

// Same normalisation as the web AuthContext: customer/vehicle may arrive populated (objects).
function normalizeUser(rawUser) {
  if (!rawUser) return rawUser;
  const idOf = (value) => (value && typeof value === 'object' ? value._id || value.id || String(value) : value);
  return { ...rawUser, customer: idOf(rawUser.customer), vehicle: idOf(rawUser.vehicle) };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { token, user: storedUser } = await getSession();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled && storedUser) setUser(normalizeUser(storedUser));
      try {
        const res = await api.getMe();
        const nextUser = normalizeUser(res.data.user);
        await saveSession({ user: nextUser });
        if (!cancelled) setUser(nextUser);
      } catch (err) {
        // Offline or expired: keep the stored user so the app still opens; API calls will
        // refresh or sign out as appropriate.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => onSessionExpired(() => setUser(null)), []);

  async function signIn(username, password) {
    const res = await api.login(username, password);
    const nextUser = normalizeUser(res.data.user);
    await saveSession({ token: res.data.token, refreshToken: res.data.refreshToken, user: nextUser });
    setUser(nextUser);
  }

  async function signOut() {
    try { await api.logout(); } catch (err) { /* offline or already signed out */ }
    await clearSession();
    setUser(null);
  }

  // Re-reads the profile after account changes (e.g. recovery contacts saved).
  async function refreshUser() {
    try {
      const res = await api.getMe();
      const nextUser = normalizeUser(res.data.user);
      await saveSession({ user: nextUser });
      setUser(nextUser);
    } catch (err) { /* keep the current user */ }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
