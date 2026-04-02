import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, User, LogIn, LogOut, ShieldCheck, ChevronDown, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';

const Navbar = () => {
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); setDropdownOpen(false); setShowLogoutModal(false); };

  return (
    <nav>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        {/* Logo */}
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          CStore <span style={{ fontWeight: 300, fontSize: '0.9rem', color: '#94a3b8' }}>PREMIUM</span>
        </Link>

        {/* Nav Links - Desktop Only */}
        <div className="desktop-only" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/" style={{ color: '#f8fafc', textDecoration: 'none', gap: '0.5rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
            <LayoutGrid size={17} /> Store
          </Link>
          
          <Link to={isLoggedIn ? "/upload" : "/login"} style={{ color: '#f8fafc', textDecoration: 'none', gap: '0.5rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
            <Upload size={17} /> Upload
          </Link>
        </div>

        {/* Auth Section */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>


          {isLoggedIn ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  background: isAdmin ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))' : 'rgba(255,255,255,0.07)',
                  border: isAdmin ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--glass-border)',
                  borderRadius: '10px', padding: '8px 14px', color: 'white', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                {isAdmin ? <ShieldCheck size={16} color="#a5b4fc" /> : <User size={16} />}
                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</span>
                <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#1e293b',
                  border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '8px',
                  minWidth: '180px', boxShadow: '0 10px 40px rgba(0,0_0,0.4)', zIndex: 1000
                }}>
                  {isAdmin ? (
                    <>
                      <Link to="/admin" onClick={() => setDropdownOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '10px 14px', borderRadius: '8px', color: '#a5b4fc', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
                        <ShieldCheck size={16} /> Admin Panel
                      </Link>
                      <Link to="/" onClick={() => setDropdownOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '10px 14px', borderRadius: '8px', color: '#f8fafc', textDecoration: 'none', fontSize: '0.9rem' }}>
                        <LayoutGrid size={16} /> View Store
                      </Link>
                    </>
                  ) : (
                    <Link to="/dashboard" onClick={() => setDropdownOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '10px 14px', borderRadius: '8px', color: '#f8fafc', textDecoration: 'none', fontSize: '0.9rem' }}>
                      <User size={16} /> My Dashboard
                    </Link>
                  )}
                  <Link to="/upload" onClick={() => setDropdownOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '10px 14px', borderRadius: '8px', color: '#f8fafc', textDecoration: 'none', fontSize: '0.9rem' }}>
                    <Upload size={16} /> Upload App
                  </Link>
                  <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />
                  <button onClick={() => { setShowLogoutModal(true); setDropdownOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '10px 14px', borderRadius: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 18px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LogIn size={17} /> Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal 
        isOpen={showLogoutModal}
        title="Logout?"
        message="Are you sure you want to log out from CStore?"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
        type="danger"
      />

      {/* Backdrop for dropdown */}
      {dropdownOpen && (
        <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
      )}
    </nav>
  );
};

export default Navbar;
