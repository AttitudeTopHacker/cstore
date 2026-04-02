import React, { createContext, useContext, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '../supabaseClient';
import config from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Helper: sync supabase user with our backend ───────────────────────────
  const syncUserWithBackend = async (supabaseUser) => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/auth/google-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: supabaseUser.email,
          name: supabaseUser.user_metadata?.full_name || supabaseUser.email,
          supabase_id: supabaseUser.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.isNew || data.user) {
        _setLogin(data.user, data.token);
      }
      return data;
    } catch (err) {
      console.error('Backend sync failed:', err);
    }
  };

  // ─── Internal login setter ──────────────────────────────────────────────────
  const _setLogin = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('cstore_token', tokenData);
    localStorage.setItem('cstore_user', JSON.stringify(userData));
  };

  // ─── Init: load stored session + check supabase session ────────────────────
  useEffect(() => {
    const initAuth = async () => {
      // Fast load from localStorage
      const storedToken = localStorage.getItem('cstore_token');
      const storedUser  = localStorage.getItem('cstore_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }

      // Check live Supabase session (handles web OAuth redirect hash)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncUserWithBackend(session.user);
      }

      setLoading(false);
    };

    initAuth();

    // ── Android deep-link handler ─────────────────────────────────────────────
    // After Google auth, Chrome redirects to com.cstore.app://login?code=...
    // KEY FIX: extract ONLY the 'code' param — not the full URL.
    const setupDeepLink = async () => {
      if (!Capacitor.isNativePlatform()) return;

      App.addListener('appUrlOpen', async (event) => {
        console.log('[DeepLink] received:', event.url);
        try {
          const parsedUrl = new URL(event.url);

          // PKCE flow (Supabase v2 default): URL has ?code=XXXXXXXX
          const code = parsedUrl.searchParams.get('code');

          // Implicit flow fallback: URL has #access_token=...&refresh_token=...
          const hash = parsedUrl.hash.replace('#', '');
          const hashParams   = new URLSearchParams(hash);
          const accessToken  = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (code) {
            console.log('[DeepLink] PKCE code found, exchanging...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.error('[DeepLink] exchange failed:', error.message);
              // onAuthStateChange may still fire — do nothing extra
            } else if (data?.session?.user) {
              console.log('[DeepLink] PKCE success:', data.session.user.email);
              await syncUserWithBackend(data.session.user);
            }
          } else if (accessToken && refreshToken) {
            console.log('[DeepLink] implicit tokens found, setting session...');
            const { data, error } = await supabase.auth.setSession({
              access_token:  accessToken,
              refresh_token: refreshToken,
            });
            if (!error && data?.session?.user) {
              await syncUserWithBackend(data.session.user);
            }
          } else {
            // Supabase may have already handled it via detectSessionInUrl
            console.log('[DeepLink] no code/token in URL, checking session...');
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) await syncUserWithBackend(session.user);
          }
        } catch (err) {
          console.error('[DeepLink] parse error:', err);
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) await syncUserWithBackend(session.user);
        }
      });
    };

    setupDeepLink();

    // ── Listen for auth state changes (covers all platforms) ─────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] event:', event);
        if (session?.user) {
          await syncUserWithBackend(session.user);
        } else if (event === 'SIGNED_OUT') {
          _clearAuth();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      if (Capacitor.isNativePlatform()) App.removeAllListeners();
    };
  }, []);

  // ─── Auth actions ───────────────────────────────────────────────────────────
  const _clearAuth = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('cstore_token');
    localStorage.removeItem('cstore_user');
  };

  const login = (userData, tokenData) => _setLogin(userData, tokenData);

  const logout = async () => {
    // Clear UI state immediately
    _clearAuth();
    // Sign out from Supabase in background
    supabase.auth.signOut().catch((err) =>
      console.error('Supabase signout error:', err)
    );
    window.location.href = '/';
  };

  const loginWithGoogle = async () => {
    const isNativeApp = Capacitor.isNativePlatform();

    // Native Android/iOS → custom URL scheme so browser returns to app
    // Web               → stay on same origin
    const redirectTo = isNativeApp
      ? 'com.cstore.app://login'
      : `${window.location.origin}/login`;

    console.log('[Google] redirectTo:', redirectTo, '| native:', isNativeApp);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      },
    });
    if (error) throw error;
  };

  const completeProfile = async (profileData) => {
    const res = await fetch(`${config.API_BASE_URL}/auth/complete-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    _setLogin(data.user, data.token);
    return data;
  };

  const isAdmin    = user?.role === 'admin';
  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider
      value={{
        user, token, loading,
        isAdmin, isLoggedIn,
        login, logout, loginWithGoogle, completeProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
