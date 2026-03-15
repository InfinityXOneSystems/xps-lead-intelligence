'use client';

/**
 * Real authentication context.
 * Manages Google, GitHub, and Railway account connections.
 * When any account connects, it auto-enables the related features.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface AccountInfo {
  connected: boolean;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  userLogin?: string;  // GitHub handle
  connectedAt?: string;
}

export interface AuthState {
  google?: AccountInfo;
  github?: AccountInfo;
  railway?: AccountInfo;
}

export interface AuthContextValue {
  auth: AuthState;
  anyConnected: boolean;
  loading: boolean;
  /** Get a Google OAuth URL, then open it in the current window */
  loginGoogle: () => Promise<void>;
  /** Get a GitHub OAuth URL, then open it in the current window */
  loginGithub: () => Promise<void>;
  /** Validate a Railway API token */
  loginRailway: (token: string) => Promise<{ success: boolean; message: string }>;
  /** Disconnect one or all providers */
  logout: (provider?: 'google' | 'github' | 'railway') => Promise<void>;
  /** Refresh auth status from backend */
  refresh: () => Promise<void>;
  /** Bearer token to attach to API requests */
  sessionToken: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'xps_session_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({});
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const initialised = useRef(false);

  // ── Load token from localStorage on mount ─────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setSessionToken(stored);
  }, []);

  // ── Handle OAuth callback params in URL ──────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    const token = params.get('token');
    if (authStatus === 'success' && token) {
      localStorage.setItem(TOKEN_KEY, token);
      setSessionToken(token);
      // Clean URL
      const clean = window.location.pathname;
      window.history.replaceState({}, document.title, clean);
    }
  }, []);

  // ── Fetch auth status ────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/status`);
      if (!res.ok) {
        setAuth({});
        return;
      }
      const data = await res.json() as { accounts: AuthState };
      setAuth(data.accounts || {});
    } catch {
      setAuth({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    void refresh();
  }, [refresh]);

  // ── Google login ──────────────────────────────────────────────────────────
  const loginGoogle = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/auth/google/url`);
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
    const { url } = await res.json() as { url: string };
    window.location.href = url;
  }, []);

  // ── GitHub login ──────────────────────────────────────────────────────────
  const loginGithub = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/auth/github/url`);
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
    const { url } = await res.json() as { url: string };
    window.location.href = url;
  }, []);

  // ── Railway login ─────────────────────────────────────────────────────────
  const loginRailway = useCallback(async (token: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_URL}/api/auth/railway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json() as { success?: boolean; token?: string; message?: string; error?: string };
    if (res.ok && data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
      setSessionToken(data.token);
      await refresh();
      return { success: true, message: data.message || 'Railway connected' };
    }
    return { success: false, message: data.error || 'Failed to connect Railway' };
  }, [refresh]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async (provider?: 'google' | 'github' | 'railway') => {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    if (!provider) {
      localStorage.removeItem(TOKEN_KEY);
      setSessionToken(null);
    }
    await refresh();
  }, [refresh]);

  const anyConnected = Object.values(auth).some((a) => a?.connected);

  return (
    <AuthContext.Provider value={{ auth, anyConnected, loading, loginGoogle, loginGithub, loginRailway, logout, refresh, sessionToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
