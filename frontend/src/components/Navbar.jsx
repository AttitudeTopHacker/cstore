import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Compass, LayoutGrid, Users, BookOpen, Upload, LogIn, LogOut, 
  ShieldCheck, User, ChevronDown, Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ConfirmModal from './ConfirmModal';

// Concept 2 Glowing Futuristic CStore Hexagon/Cube Logo
const CStoreLogo = ({ size = 29 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ 
      filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.65))',
      flexShrink: 0,
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }}
  >
    <defs>
      <linearGradient id="cstoreHexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="50%" stopColor="#818cf8" />
        <stop offset="100%" stopColor="#c084fc" />
      </linearGradient>
      <linearGradient id="cstoreC" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#c084fc" />
      </linearGradient>
      <linearGradient id="cstoreBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(56, 189, 248, 0.16)" />
        <stop offset="100%" stopColor="rgba(192, 132, 252, 0.16)" />
      </linearGradient>
    </defs>
    
    {/* Outer Isometric Hexagon Container */}
    <path 
      d="M16 2.5L28 9.5V22.5L16 29.5L4 22.5V9.5L16 2.5Z" 
      fill="url(#cstoreBg)" 
      stroke="url(#cstoreHexGrad)" 
      strokeWidth="2" 
      strokeLinejoin="round" 
    />
    
    {/* Geometric Stylized C inside */}
    <path 
      d="M21.5 11L16 7.8L10.5 11V21L16 24.2L21.5 21" 
      stroke="url(#cstoreC)" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    
    {/* Central Glowing Node / Hex Accent */}
    <circle cx="16" cy="16" r="2.2" fill="#38bdf8" />
  </svg>
);

const Navbar = () => {
  const { user, token, login, isLoggedIn, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [imgError, setImgError] = useState(false);

  // If active user is missing avatar_url, detect it directly from Supabase session
  useEffect(() => {
    if (isLoggedIn && !user?.avatar_url) {
      supabase.auth.getUser().then(({ data }) => {
        const sbUser = data?.user;
        if (sbUser) {
          const detectedAvatar =
            sbUser.user_metadata?.avatar_url ||
            sbUser.user_metadata?.picture ||
            sbUser.identities?.[0]?.identity_data?.avatar_url ||
            sbUser.identities?.[0]?.identity_data?.picture ||
            null;

          if (detectedAvatar && detectedAvatar !== user?.avatar_url) {
            login({ ...user, avatar_url: detectedAvatar }, token || 'direct_supabase_session');
          }
        }
      }).catch((e) => console.warn('Avatar auto-detect:', e));
    }
  }, [isLoggedIn, user?.avatar_url]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setDropdownOpen(false);
    setShowLogoutModal(false);
  };

  // Determine avatar image or fallback initial letter
  const avatarUrl =
    user?.avatar_url ||
    user?.picture ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.identities?.[0]?.identity_data?.avatar_url ||
    user?.identities?.[0]?.identity_data?.picture ||
    null;

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const initialLetter = (displayName || 'U').trim().charAt(0).toUpperCase();

  // Helper for active navigation link styling
  const isNavActive = (path, activePath) => {
    const check = activePath || path;
    if (check === '/') return location.pathname === '/';
    return location.pathname.startsWith(check);
  };

  const navLinks = [
    { label: 'Explore', path: '/', icon: Compass },
    { label: 'Apps', path: '/apps', icon: LayoutGrid },
    { label: 'Teams', path: '/developers', icon: Users },
    { label: 'Docs', path: '/docs', icon: BookOpen },
  ];

  return (
    <nav className="top-navbar" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      width: '100%',
      zIndex: 1000,
      background: 'rgba(2, 6, 23, 0.92)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid var(--glass-border)',
      padding: '0.65rem 0',
      transition: 'all 0.2s ease'
    }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        
        {/* Left: Brand Logo */}
        <Link to="/" className="logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <CStoreLogo size={29} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.02em' }}>CStore</span> 
            <span className="text-premium" style={{ fontSize: '0.70rem', letterSpacing: '0.08em' }}>PREMIUM</span>
          </div>
        </Link>

        {/* Center: Concept 2 Navigation Tabs (Desktop) */}
        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {navLinks.map((tab) => {
            const active = isNavActive(tab.path, tab.activePath);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '7px 15px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#ffffff' : '#94a3b8',
                  background: active ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'transparent',
                  border: active ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid transparent',
                  boxShadow: active ? '0 2px 10px rgba(99, 102, 241, 0.2)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#e2e8f0';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon size={15} style={{ color: active ? 'var(--primary)' : 'inherit' }} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Section: Auth Profile / Sign In */}
        <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
          
          {/* User Profile Avatar / Sign In */}
          {isLoggedIn ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                title={displayName}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  padding: 0,
                  border: isAdmin ? '2px solid #818cf8' : '2px solid rgba(255, 255, 255, 0.2)',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isAdmin ? '0 0 10px rgba(129, 140, 248, 0.35)' : 'none',
                  transition: 'transform 0.2s ease',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {avatarUrl && !imgError ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}>
                    {initialLetter}
                  </div>
                )}
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 10px)',
                    width: '230px',
                    background: 'rgba(15, 23, 42, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
                    padding: '8px',
                    zIndex: 999,
                    animation: 'fadeIn 0.15s ease'
                  }}>
                    {/* User Info Header */}
                    <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.email}
                      </div>
                      {isAdmin && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          marginTop: '6px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#a5b4fc',
                          fontSize: '0.7rem',
                          fontWeight: 700
                        }}>
                          <ShieldCheck size={11} /> ADMIN
                        </span>
                      )}
                    </div>

                    {/* Menu Links */}
                    <Link
                      to="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        color: '#cbd5e1',
                        textDecoration: 'none',
                        fontSize: '0.88rem',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <User size={15} /> My Dashboard
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          color: '#a5b4fc',
                          textDecoration: 'none',
                          fontSize: '0.88rem',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <ShieldCheck size={15} /> Admin Console
                      </Link>
                    )}

                    <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '6px 0' }} />

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setShowLogoutModal(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        color: '#f87171',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '7px 16px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.85rem',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.1)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </Link>
          )}

        </div>

      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title="Sign Out"
        message="Are you sure you want to sign out of CStore?"
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        type="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </nav>
  );
};

export default Navbar;
