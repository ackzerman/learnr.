import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authAPI, setAccessToken, refreshSession } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const loggingOut = useRef(false);

  // Restore session on reload via HttpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Single-flight: shares one rotation with any concurrent caller
        // (e.g. the OAuth callback page), so racers can't invalidate each other.
        const d = await refreshSession();
        if (cancelled) return;
        setAccessToken(d.accessToken || d.token || null);
        setUser(d.user || null);
      } catch (_) {
        if (!cancelled) { setAccessToken(null); setUser(null); }
      } finally {
        if (!cancelled) { setLoading(false); setInitialized(true); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback((accessTok, u) => {
    setAccessToken(accessTok || null);
    setUser(u || null);
  }, []);

  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try { await authAPI.logout(); } catch (_) {
      // Backend unreachable — still clear local state. Server-side
      // revocation cannot be guaranteed in that case.
    } finally {
      setAccessToken(null);
      setUser(null);
      loggingOut.current = false;
    }
  }, []);

  const refreshUser = async () => {
    try { const d = await authAPI.me(); setUser(d.user); } catch (_) {}
  };

  // isAuthenticated derives from user (populated on login + refresh restore).
  return (
    <AuthContext.Provider value={{ user, loading, initialized, isAuthenticated: !!user, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
