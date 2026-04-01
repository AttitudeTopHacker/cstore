import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import config from '../config';
import { App } from '@capacitor/app';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize and check Supabase session
  useEffect(() => {
    const initAuth = async () => {
      // 1. Check local storage first (legacy/fast load)
      const storedToken = localStorage.getItem('cstore_token');
      const storedUser = localStorage.getItem('cstore_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }

      // 2. Check Supabase session (handles redirects/social login)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncUserWithBackend(session.user);
      }
      
      setLoading(false);
    };

    initAuth();

    // Deep link listener for mobile app
    const setupDeepLink = async () => {
      App.addListener('appUrlOpen', async (event) => {
        // Example: com.cstore.app://login#access_token=...
        const url = new URL(event.url);
        if (url.hash) {
          // Supabase handles the hash automatically when getSession is called
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await syncUserWithBackend(session.user);
          }
        }
      });
    };

    setupDeepLink();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await syncUserWithBackend(session.user);
      } else if (event === 'SIGNED_OUT') {
        logout();
      }
    });

    return () => {
      subscription.unsubscribe();
      App.removeAllListeners();
    };
  }, []);

  const syncUserWithBackend = async (supabaseUser) => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/auth/google-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: supabaseUser.email,
          name: supabaseUser.user_metadata.full_name,
          supabase_id: supabaseUser.id
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (!data.isNew || data.user) {
        login(data.user, data.token);
      }
      return data;
    } catch (err) {
      console.error('Backend sync failed:', err);
    }
  };

  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('cstore_token', tokenData);
    localStorage.setItem('cstore_user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Supabase signout error:', err);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('cstore_token');
    localStorage.removeItem('cstore_user');
    // Force a full page reload to Home to clear all states
    window.location.href = '/';
  };

  const loginWithGoogle = async () => {
    // On Android, use the custom scheme, on Web use the current site URL
    const isApp = window.location.hostname === 'localhost' && !window.location.port;
    const redirectTo = isApp ? 'com.cstore.app://login' : window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
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
    login(data.user, data.token);
    return data;
  };

  const isAdmin = user?.role === 'admin';
  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{ 
      user, token, loading, isAdmin, isLoggedIn, 
      login, logout, loginWithGoogle, completeProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
