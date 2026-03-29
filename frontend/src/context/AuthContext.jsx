import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import config from '../config';

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
        // Sync with backend to get full user role/object
        await syncUserWithBackend(session.user);
      }
      
      setLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await syncUserWithBackend(session.user);
      } else if (event === 'SIGNED_OUT') {
        logout();
      }
    });

    return () => subscription.unsubscribe();
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
      
      if (!data.isNew) {
        login(data.user, data.token);
      } else {
        // We'll handle 'isNew' in the Login page to show popup
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
    await supabase.auth.signOut();
    setUser(null);
    setToken(null);
    localStorage.removeItem('cstore_token');
    localStorage.removeItem('cstore_user');
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
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
