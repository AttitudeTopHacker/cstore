import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, AlertCircle, Loader2, UserPlus, CheckCircle } from 'lucide-react';
import { useAuth, isAdminUser } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [status, setStatus] = useState({ loading: false, error: null, success: null });
  const [showModal, setShowModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ name: '', email: '', password: '' });
  const { login, loginWithGoogle, completeProfile, isLoggedIn, user, isNewUser, pendingUser, setIsNewUser } = useAuth();
  const navigate = useNavigate();
  
  // React to successful login
  useEffect(() => {
    if (isLoggedIn && !isNewUser) {
      navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [isLoggedIn, isNewUser, user, navigate]);

  // React to new user needing profile completion
  useEffect(() => {
    if (isNewUser && pendingUser) {
      setNewUserData({
        name: pendingUser.name,
        email: pendingUser.email,
        password: ''
      });
      setShowModal(true);
    }
  }, [isNewUser, pendingUser]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: null, success: null });

    const trimmedInput = (formData.email || '').trim().toLowerCase();
    const inputPassword = (formData.password || '').trim();
    const normalizedPass = inputPassword.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Direct Master Admin check (works 100% locally)
    const isAdminAccount = (
      trimmedInput === 'cstore' ||
      trimmedInput === 'admin' ||
      trimmedInput === 'salman' ||
      trimmedInput === 'aattitudetophacker@gmail.com' ||
      trimmedInput === 'attitudetophacker@gmail.com' ||
      trimmedInput === 'mohdsalman4151@gmail.com' ||
      trimmedInput === 'salman.movin@gmail.com' ||
      trimmedInput.includes('cstore') ||
      trimmedInput.includes('admin')
    );

    const isMasterPassword = (
      inputPassword === 'Salman@134' ||
      inputPassword.toLowerCase() === 'salman@134' ||
      normalizedPass === 'salman134'
    );

    if (isAdminAccount && isMasterPassword) {
      const adminUser = {
        id: 'admin',
        name: 'Admin (Salman)',
        email: trimmedInput.includes('@') ? trimmedInput : `${trimmedInput}@cstore.app`,
        role: 'admin'
      };
      login(adminUser, 'cstore_admin_token');
      setStatus({ loading: false, error: null, success: null });
      navigate('/admin');
      return;
    }

    // 2. Handle Sign Up vs Sign In
    if (isSignUp) {
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: formData.password
        });

        if (signUpError) throw signUpError;

        if (signUpData?.user && signUpData?.session) {
          const isUserAdmin = isAdminUser(signUpData.user.email);
          const u = {
            id: signUpData.user.id,
            name: signUpData.user.user_metadata?.full_name || signUpData.user.email.split('@')[0],
            email: signUpData.user.email,
            role: isUserAdmin ? 'admin' : 'user'
          };
          login(u, signUpData.session.access_token);
          setStatus({ loading: false, error: null, success: 'Account created successfully!' });
          navigate(isUserAdmin ? '/admin' : '/dashboard');
          return;
        }

        setStatus({ 
          loading: false, 
          error: null, 
          success: 'Account created! Please check your email to confirm your account, or sign in.' 
        });
      } catch (err) {
        console.error('Sign up error:', err);
        setStatus({ loading: false, error: err.message || 'Registration failed.', success: null });
      }
      return;
    }

    // 3. Direct Supabase Auth Sign In
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password
      });

      if (!authError && authData?.user) {
        const isUserAdmin = isAdminUser(authData.user.email);
        const u = {
          id: authData.user.id,
          name: authData.user.user_metadata?.full_name || authData.user.email.split('@')[0],
          email: authData.user.email,
          role: isUserAdmin ? 'admin' : 'user'
        };
        login(u, authData.session?.access_token || 'supabase_token');
        setStatus({ loading: false, error: null, success: null });
        navigate(isUserAdmin ? '/admin' : '/dashboard');
        return;
      }

      // Check users table fallback
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${formData.email.trim()},name.eq.${formData.email.trim()}`)
        .maybeSingle();

      if (userRow && userRow.status !== 'suspended') {
        if (isAdminUser(userRow)) {
          userRow.role = 'admin';
        }
        login(userRow, 'supabase_token');
        setStatus({ loading: false, error: null, success: null });
        navigate(userRow.role === 'admin' ? '/admin' : '/dashboard');
        return;
      }

      throw new Error(authError?.message || 'Invalid email or password. If you do not have an account, click "Sign Up" above.');
    } catch (err) {
      console.error('Login error:', err);
      setStatus({ 
        loading: false, 
        error: err.message || 'Login failed. If you are a new user, please switch to Sign Up.',
        success: null 
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setStatus({ loading: true, error: null, success: null });
      await loginWithGoogle();
    } catch (err) {
      console.error('Google login error:', err);
      setStatus({ loading: false, error: err.message, success: null });
    }
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: null, success: null });
    try {
      const updatedProfileData = {
        ...newUserData,
        supabase_id: pendingUser.supabase_id
      };
      
      const data = await completeProfile(updatedProfileData);
      setShowModal(false);
      setIsNewUser(false);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setStatus({ loading: false, error: err.message, success: null });
    }
  };

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            {isSignUp ? <UserPlus size={28} color="white" /> : <LogIn size={28} color="white" />}
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            {isSignUp ? 'Sign up to upload and track apps on CStore' : 'Sign in to access your CStore dashboard'}
          </p>
        </div>

        <div className="glass" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Mode Switch Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px' }}>
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setStatus({ loading: false, error: null, success: null }); }}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: !isSignUp ? 'var(--primary)' : 'transparent',
                color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setStatus({ loading: false, error: null, success: null }); }}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: isSignUp ? 'var(--primary)' : 'transparent',
                color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Google Login Button */}
          <button onClick={handleGoogleLogin} disabled={status.loading}
            style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: 'white', color: '#1f2937', borderRadius: '10px', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="" />
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
            OR
            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Email / Username */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
                {isSignUp ? 'Email Address *' : 'Email or Username *'}
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={isSignUp ? "email" : "text"}
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={isSignUp ? "name@example.com" : "name@example.com or cstore"}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px 12px 12px 44px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={isSignUp ? "Min. 6 characters" : "••••••••"}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px 12px 12px 44px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {status.error && (
              <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <AlertCircle size={16} /> {status.error}
              </div>
            )}

            {status.success && (
              <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <CheckCircle size={16} /> {status.success}
              </div>
            )}

            <button type="submit" disabled={status.loading} className="btn-primary"
              style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontSize: '1rem' }}>
              {status.loading ? <><Loader2 size={20} className="animate-spin" /> Processing...</> : isSignUp ? <><UserPlus size={20} /> Create Account</> : <><LogIn size={20} /> Sign In</>}
            </button>
          </form>
        </div>
      </div>

      {/* Profile Completion Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', border: '1px solid var(--primary)' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>Complete Your Profile</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>Set a username to finish your profile.</p>
            
            <form onSubmit={handleCompleteProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" required value={newUserData.name} onChange={e => setNewUserData({...newUserData, name: e.target.value})} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '10px 10px 10px 40px', borderRadius: '8px', color: 'white', outline: 'none' }} />
                </div>
              </div>
              <button type="submit" disabled={status.loading} className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: '0.5rem' }}>
                {status.loading ? <Loader2 className="animate-spin" /> : 'Finish & Open Dashboard'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
