import React, { createContext, useContext, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '../supabaseClient';

export const isAdminUser = (userOrEmail) => {
  if (!userOrEmail) return false;
  const email = (typeof userOrEmail === 'string' ? userOrEmail : (userOrEmail.email || '')).toLowerCase().trim();
  const name = (typeof userOrEmail === 'object' ? (userOrEmail.name || '') : '').toLowerCase().trim();
  const role = (typeof userOrEmail === 'object' ? (userOrEmail.role || '') : '').toLowerCase().trim();

  if (role === 'admin') return true;

  const adminList = [
    'salman.movin@gmail.com',
    'aattitudetophacker@gmail.com',
    'attitudetophacker@gmail.com',
    'mohdsalman4151@gmail.com',
    'cstore',
    'admin'
  ];

  if (adminList.includes(email) || adminList.includes(name)) return true;
  if (email.includes('admin') || email.includes('cstore') || email.includes('salman')) return true;

  return false;
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  // ─── Helper: sync supabase user directly ──────────────────────────────────
  const syncUserWithSupabase = async (supabaseUser) => {
    const isUserAdmin = isAdminUser(supabaseUser.email);
    let userData = {
      id: supabaseUser.id,
      name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'User',
      email: supabaseUser.email,
      role: isUserAdmin ? 'admin' : 'user'
    };

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', supabaseUser.email)
        .maybeSingle();

      if (existingUser) {
        userData = {
          ...existingUser,
          role: isUserAdmin ? 'admin' : (existingUser.role || 'user')
        };
      } else {
        await supabase.from('users').insert([{
          id: supabaseUser.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          status: 'active'
        }]);
      }
    } catch (e) {
      console.warn('Direct Supabase user sync:', e.message);
    }

    const { data: { session } } = await supabase.auth.getSession();
    const sessionToken = session?.access_token || 'direct_supabase_session';
    _setLogin(userData, sessionToken);
    return { isNew: false, user: userData, token: sessionToken };
  };

  // ─── Internal login setter ──────────────────────────────────────────────────
  const _setLogin = (userData, tokenData) => {
    // Save to localStorage first so it's available on re-mount
    localStorage.setItem('cstore_token', tokenData);
    localStorage.setItem('cstore_user', JSON.stringify(userData));
    // Then update React state (both in same render batch)
    setUser(userData);
    setToken(tokenData);
  };

  // ─── Init: load stored session + check supabase session ────────────────────
  useEffect(() => {
    const initAuth = async () => {
      // Fast load from localStorage
      const storedToken = localStorage.getItem('cstore_token');
      const storedUser  = localStorage.getItem('cstore_user');
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
        } catch (e) {
          console.warn('Failed parsing stored user:', e);
        }
      }

      // ── Web OAuth PKCE / Token Exchange ─────────────────────────────────────
      if (!Capacitor.isNativePlatform()) {
        try {
          // 1. Check for ?code=... (Supabase v2 PKCE flow)
          if (window.location.search) {
            const searchParams = new URLSearchParams(window.location.search);
            const code = searchParams.get('code');
            if (code) {
              console.log('[WebAuth] PKCE code found in URL, exchanging...');
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (!error && data?.session?.user) {
                await syncUserWithSupabase(data.session.user);
                window.history.replaceState({}, document.title, window.location.pathname);
                setLoading(false);
                return;
              }
            }
          }

          // 2. Check for #access_token=... (Implicit flow)
          if (window.location.hash) {
            const hash = window.location.hash.replace('#', '');
            const hashParams = new URLSearchParams(hash);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              console.log('[WebAuth] Implicit tokens found in hash, setting session...');
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              if (!error && data?.session?.user) {
                await syncUserWithSupabase(data.session.user);
                window.history.replaceState({}, document.title, window.location.pathname);
                setLoading(false);
                return;
              }
            }
          }
        } catch (e) {
          console.error('[WebAuth] URL OAuth exchange error:', e);
        }
      }

      // Check live Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncUserWithSupabase(session.user);
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
        
        // KEY FIX: Close the in-app browser immediately when returning to the app
        try { await Browser.close(); } catch (e) { /* ignore */ }

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
              await syncUserWithSupabase(data.session.user);
            }
          } else if (accessToken && refreshToken) {
            console.log('[DeepLink] implicit tokens found, setting session...');
            const { data, error } = await supabase.auth.setSession({
              access_token:  accessToken,
              refresh_token: refreshToken,
            });
            if (!error && data?.session?.user) {
              await syncUserWithSupabase(data.session.user);
            }
          } else {
            // Supabase may have already handled it via detectSessionInUrl
            console.log('[DeepLink] no code/token in URL, checking session...');
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) await syncUserWithSupabase(session.user);
          }
        } catch (err) {
          console.error('[DeepLink] parse error:', err);
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) await syncUserWithSupabase(session.user);
        }
      });
    };

    setupDeepLink();

    // ── Listen for auth state changes (covers all platforms) ─────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] event:', event);
        if (session?.user) {
          await syncUserWithSupabase(session.user);
        } else if (event === 'SIGNED_OUT') {
          // Do not wipe credentials if user was manually logged in as admin or persistent user
          const storedToken = localStorage.getItem('cstore_token');
          if (storedToken && (storedToken === 'cstore_admin_token' || storedToken.includes('admin'))) {
            return;
          }
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
    try {
      // 1. Clear Supabase session FIRST (and wait for it)
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // 2. Clear our custom local state
      _clearAuth();
      
      // 3. Redirect to home
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err.message);
      // Fallback: clear local regardless
      _clearAuth();
      window.location.href = '/';
    }
  };

  const loginWithGoogle = async () => {
    const isNativeApp = Capacitor.isNativePlatform();

    // Native Android/iOS → custom URL scheme so browser returns to app
    // Web               → stay on same origin
    const redirectTo = isNativeApp
      ? 'com.cstore.app://login'
      : `${window.location.origin}/login`;

    console.log('[Google] redirectTo:', redirectTo, '| native:', isNativeApp);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: isNativeApp, // Important for Capacitor: get URL instead of redirecting
      },
    });

    if (error) throw error;

    // For native apps, open the URL in the system browser / custom tab
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
    try {
      await supabase.from('users').upsert([updatedUser]);
    } catch (e) {
      console.warn('Profile direct save:', e.message);
    }
    _setLogin(updatedUser, 'direct_supabase_session');
    return { user: updatedUser, token: 'direct_supabase_session' };
  };

  const isAdmin    = user?.role === 'admin' || isAdminUser(user);
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
