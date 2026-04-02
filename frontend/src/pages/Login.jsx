import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, AlertCircle, Loader2, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import config from '../config';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [status, setStatus] = useState({ loading: false, error: null });
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
    setStatus({ loading: true, error: null });
    try {
      const res = await fetch(`${config.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.user, data.token);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setStatus({ loading: true, error: null });
      await loginWithGoogle();
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: null });
    try {
      // Use pendingUser for supabase_id and current form data for name/email/password
      const updatedProfileData = {
        ...newUserData,
        supabase_id: pendingUser.supabase_id
      };
      
      const data = await completeProfile(updatedProfileData);
      setShowModal(false);
      setIsNewUser(false); // Reset the flag
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <LogIn size={28} color="white" />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)' }}>Sign in to your CStore account</p>
        </div>

        <div className="glass" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
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
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Email or Username</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text" name="email" required value={formData.email} onChange={handleChange}
                  placeholder="name@example.com or username"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px 12px 12px 44px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password" name="password" required value={formData.password} onChange={handleChange}
                  placeholder="••••••••"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px 12px 12px 44px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>
            </div>

            {status.error && (
              <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <AlertCircle size={16} /> {status.error}
              </div>
            )}

            <button type="submit" disabled={status.loading} className="btn-primary"
              style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontSize: '1rem' }}>
              {status.loading ? <><Loader2 size={20} className="animate-spin" /> Processing...</> : <><LogIn size={20} /> Sign In</>}
            </button>
          </form>
        </div>
      </div>

      {/* Profile Completion Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', border: '1px solid var(--primary)' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>Complete Your Profile</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>Set a username and password to finish your registration.</p>
            
            <form onSubmit={handleCompleteProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" required value={newUserData.name} onChange={e => setNewUserData({...newUserData, name: e.target.value})} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '10px 10px 10px 40px', borderRadius: '8px', color: 'white', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Create Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="password" required placeholder="Min. 6 chars" value={newUserData.password} onChange={e => setNewUserData({...newUserData, password: e.target.value})} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '10px 10px 10px 40px', borderRadius: '8px', color: 'white', outline: 'none' }} />
                </div>
              </div>
              <button type="submit" disabled={status.loading} className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: '0.5rem' }}>
                {status.loading ? <Loader2 className="animate-spin" /> : 'Set Profile & Finish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
