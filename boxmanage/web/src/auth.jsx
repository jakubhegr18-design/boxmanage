import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import { navigate } from './navigate';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function refresh() {
    const u = await api('/api/auth/me');
    setUser(u);
    return u;
  }

  function logout() {
    setToken(null);
    setUser(null);
    navigate('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
