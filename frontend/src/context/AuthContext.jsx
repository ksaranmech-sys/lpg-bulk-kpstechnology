import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../api/api';
import { getSession, saveSession, clearSession } from '../api/session';

const AuthContext = createContext(null);

function normalizeUser(rawUser) {
  if (!rawUser) return rawUser;

  const customer = rawUser.customer && typeof rawUser.customer === 'object'
    ? (rawUser.customer._id || rawUser.customer.id || String(rawUser.customer))
    : rawUser.customer;

  const vehicle = rawUser.vehicle && typeof rawUser.vehicle === 'object'
    ? (rawUser.vehicle._id || rawUser.vehicle.id || String(rawUser.vehicle))
    : rawUser.vehicle;

  return {
    ...rawUser,
    customer,
    vehicle,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => normalizeUser(getSession().user));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getSession().token) {
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then((res) => {
        const nextUser = normalizeUser(res.data.user);
        setUser(nextUser);
        saveSession({ user: nextUser });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function signIn(username, password) {
    const res = await api.login(username, password);
    const nextUser = normalizeUser(res.data.user);
    saveSession({ token: res.data.token, refreshToken: res.data.refreshToken, user: nextUser });
    setUser(nextUser);
  }

  async function signOut() {
    // Best-effort server-side revoke; the local session is cleared regardless.
    try { await api.logout(); } catch (err) { /* already signed out or offline */ }
    clearSession();
    setUser(null);
  }

  // Re-reads the profile after account changes (e.g. recovery contacts saved).
  async function refreshUser() {
    try {
      const res = await api.getMe();
      const nextUser = normalizeUser(res.data.user);
      saveSession({ user: nextUser });
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
