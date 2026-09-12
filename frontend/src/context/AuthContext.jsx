import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../api/api';

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
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('kps_user');
    return raw ? normalizeUser(JSON.parse(raw)) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kps_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then((res) => {
        const nextUser = normalizeUser(res.data.user);
        setUser(nextUser);
        localStorage.setItem('kps_user', JSON.stringify(nextUser));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function signIn(username, password) {
    const res = await api.login(username, password);
    const nextUser = normalizeUser(res.data.user);
    localStorage.setItem('kps_token', res.data.token);
    localStorage.setItem('kps_user', JSON.stringify(nextUser));
    setUser(nextUser);
  }

  function signOut() {
    localStorage.removeItem('kps_token');
    localStorage.removeItem('kps_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
