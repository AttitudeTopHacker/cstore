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
    // Capacitor fires appUrlOpen with the full URL — we exchange the code.
    const setupDeepLink = async () => {
      if (!Capacitor.isNativePlatform()) return;

      App.addListener('appUrlOpen', async (event) => {
        console.log('[DeepLink] received:', event.url);
        try {
          // Supabase PKCE flow: URL contains ?code=  (newer Supabase v2)
          // Implicit flow:      URL contains #access_token=
          if (event.url.includes('code=') || event.url.includes('access_token')) {
            // exchangeCodeForSession handles both PKCE code & access_token in hash
            const { data, error } = await supabase.auth.exchangeCodeForSession(event.url);
            if (error) {
              // Fallback: just call getSession (for implicit/access_token flows)
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) await syncUserWithBackend(session.user);
            } else if (data?.session?.user) {
              await syncUserWithBackend(data.session.user);
            }
          }
        } catch (err) {
          console.error('[DeepLink] error:', err);
          // Last resort fallback
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
