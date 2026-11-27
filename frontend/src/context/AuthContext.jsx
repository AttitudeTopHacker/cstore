import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '../supabaseClient';

export const isAdminUser = (userOrEmail) => {
  if (!userOrEmail) return false;
  const email = (typeof userOrEmail === 'string' ? userOrEmail : (userOrEmail.email || '')).toLowerCase().trim();
  const name = (typeof userOrEmail === 'object' ? (userOrEmail.name || '') : '').toLowerCase().trim();
  const role = (typeof userOrEmail === 'object' ? (userOrEmail.role || '') : '').toLowerCase().trim();

  // Exclude non-admin users explicitly
  if (email === 'mohdsalman77776@gmail.com') return false;

  const adminList = [
    'mohdsalman4151@gmail.com',
    'salman.movin@gmail.com',
    'attitudetophacker@gmail.com',
    'aattitudetophacker@gmail.com',
    'cstore',
    'admin'
  ];

  if (adminList.includes(email) || adminList.includes(name)) return true;
  if (role === 'admin' && (email.includes('admin') || email.includes('cstore') || email === 'mohdsalman4151@gmail.com')) return true;

  return false;
};

export const buildUserData = (supabaseUser) => {
  if (!supabaseUser) return null;
  const isUserAdmin = isAdminUser(supabaseUser.email);
  const avatar = 
    supabaseUser.user_metadata?.avatar_url ||
    supabaseUser.user_metadata?.picture ||
    supabaseUser.identities?.[0]?.identity_data?.avatar_url ||
    supabaseUser.identities?.[0]?.identity_data?.picture ||
    null;

  return {
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
    email: supabaseUser.email,
    avatar_url: avatar,
    role: isUserAdmin ? 'admin' : 'user'
  };
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const syncingRef = useRef(false);

  // ─── Non-blocking background sync for user row ──────────────────────────────
  // CRITICAL: Must NEVER be awaited directly inside onAuthStateChange to prevent
  // Supabase client WebLock deadlock.
  const syncUserDbBackground = (supabaseUser, currentRole = 'user') => {
    if (!supabaseUser?.email || syncingRef.current) return;
    syncingRef.current = true;

    setTimeout(async () => {
      try {
        const isUserAdmin = isAdminUser(supabaseUser.email) || currentRole === 'admin';
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, role')
          .eq('email', supabaseUser.email)
          .maybeSingle();

        if (!existingUser) {
          // Attempt insert (ignore password constraint error if any)
          await supabase.from('users').insert([{
            id: supabaseUser.id,
            name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'User',
            email: supabaseUser.email,
            password: 'oauth_managed_login',
            role: isUserAdmin ? 'admin' : 'user',
            status: 'active'
          }]);
        }
      } catch (e) {
        console.warn('[Auth] Background DB sync warning:', e.message);
      } finally {
        syncingRef.current = false;
      }
    }, 150);
  };

  // ─── Internal login setter ──────────────────────────────────────────────────
  const _setLogin = (userData, tokenData) => {
    try {
      localStorage.setItem('cstore_token', tokenData || 'direct_supabase_session');
      localStorage.setItem('cstore_user', JSON.stringify(userData));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    setUser(userData);
    setToken(tokenData || 'direct_supabase_session');
  };

  const _clearAuth = () => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem('cstore_token');
      localStorage.removeItem('cstore_user');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  // ─── Init Auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // 1. Instant hydration from localStorage
      const storedToken = localStorage.getItem('cstore_token');
      const storedUser = localStorage.getItem('cstore_user');
      if (storedToken && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (isMounted) {
            setUser(parsed);
            setToken(storedToken);
          }
        } catch (e) {
          console.warn('Failed parsing stored user:', e);
        }
      }

      // 2. Web PKCE exchange if ?code=... is in URL
      if (!Capacitor.isNativePlatform() && window.location.search && window.location.search.includes('code=')) {
        try {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          if (code) {
            console.log('[WebAuth] Found code in URL, exchanging...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data?.session?.user) {
              const u = buildUserData(data.session.user);
              if (isMounted) {
                _setLogin(u, data.session.access_token);
              }
              syncUserDbBackground(data.session.user, u.role);
            } else if (error) {
              console.warn('[WebAuth] PKCE exchange warning:', error.message);
            }
          }
        } catch (e) {
          console.warn('[WebAuth] Error during code exchange:', e);
        } finally {
          // Always clean URL so code is not processed again
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (_) {}
        }
      }

      // 3. Fallback: check active Supabase session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const u = buildUserData(session.user);
          _setLogin(u, session.access_token);
          syncUserDbBackground(session.user, u.role);
        }
      } catch (e) {
        console.warn('[Auth] getSession error:', e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // ─── Capacitor Android Deep Link Handler ──────────────────────────────────
    const setupDeepLink = async () => {
      if (!Capacitor.isNativePlatform()) return;

      App.addListener('appUrlOpen', async (event) => {
        console.log('[DeepLink] received:', event.url);
        try { await Browser.close(); } catch (e) { /* ignore */ }

        try {
          const parsedUrl = new URL(event.url);
          const code = parsedUrl.searchParams.get('code');

          if (code) {
            console.log('[DeepLink] PKCE code found, exchanging...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data?.session?.user) {
              const u = buildUserData(data.session.user);
              _setLogin(u, data.session.access_token);
              syncUserDbBackground(data.session.user, u.role);
            }
          } else {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const u = buildUserData(session.user);
              _setLogin(u, session.access_token);
              syncUserDbBackground(session.user, u.role);
            }
          }
        } catch (err) {
          console.error('[DeepLink] parse error:', err);
        }
      });
    };

    setupDeepLink();

    // ─── Non-blocking Auth State Listener ──────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] event:', event, session?.user?.email);

        if (session?.user) {
          const u = buildUserData(session.user);
          if (isMounted) {
            _setLogin(u, session.access_token);
            setLoading(false);
          }
          // Remove ?code= from URL if present
          if (window.location.search && window.location.search.includes('code=')) {
            try { window.history.replaceState({}, document.title, window.location.pathname); } catch (_) {}
          }
          // Safely defer DB sync outside this handler
          syncUserDbBackground(session.user, u.role);
        } else if (event === 'SIGNED_OUT') {
          const storedToken = localStorage.getItem('cstore_token');
          if (storedToken && (storedToken === 'cstore_admin_token' || storedToken.includes('admin'))) {
            return;
          }
          if (isMounted) {
            _clearAuth();
            setLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (Capacitor.isNativePlatform()) App.removeAllListeners();
    };
  }, []);

  // ─── Auth Actions ───────────────────────────────────────────────────────────
  const login = (userData, tokenData) => _setLogin(userData, tokenData);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Logout signOut warning:', err.message);
    }
    _clearAuth();
    window.location.href = '/';
  };

  const loginWithGoogle = async () => {
    const isNativeApp = Capacitor.isNativePlatform();

    // Native Android/iOS → custom URL scheme
    // Web               → current origin root
    const redirectTo = isNativeApp
      ? 'com.cstore.app://login'
      : `${window.location.origin}/`;

    console.log('[Google] redirectTo:', redirectTo, '| native:', isNativeApp);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: isNativeApp,
      },
    });

    if (error) throw error;

    if (isNativeApp && data?.url) {
      await Browser.open({ url: data.url, windowName: '_self' });
    }
  };

  const completeProfile = async (profileData) => {
    const isUserAdmin = isAdminUser(profileData.email);
    const updatedUser = {
      id: profileData.supabase_id || profileData.id || Date.now().toString(),
      name: profileData.name,
      email: profileData.email,
      role: isUserAdmin ? 'admin' : 'user'
    };
    _setLogin(updatedUser, 'direct_supabase_session');
    syncUserDbBackground(updatedUser, updatedUser.role);
    return { user: updatedUser, token: 'direct_supabase_session' };
  };

  const isAdmin = user?.role === 'admin' || isAdminUser(user);
  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider
      value={{
        user, token, loading,
        isAdmin, isLoggedIn,
        isNewUser, pendingUser, setIsNewUser,
        login, logout, loginWithGoogle, completeProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
