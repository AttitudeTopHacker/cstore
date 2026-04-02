import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Download, Calendar, Mail, LayoutGrid, LogOut, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import ConfirmModal from '../components/ConfirmModal';

const UserDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [profileRes, downloadsRes] = await Promise.all([
          fetch(`${config.API_BASE_URL}/user/profile`, { headers }),
          fetch(`${config.API_BASE_URL}/user/downloads`, { headers }),
        ]);
        const profileData = await profileRes.json();
        const downloadsData = await downloadsRes.json();
        setProfile(profileData);
        setDownloads(downloadsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleLogout = () => { logout(); navigate('/'); };
  const confirmLogout = () => setShowLogoutModal(true);

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <div className="flex-center" style={{ height: '70vh' }}>Loading dashboard...</div>;

  return (
    <div style={{ padding: '2.5rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            My Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Welcome back, {user?.name}!</p>
        </div>
        <button onClick={confirmLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* Profile Card */}
      <div className="glass" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={36} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{profile?.name}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
              <Mail size={15} /> {profile?.email}
            </span>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
              <Calendar size={15} /> Joined {formatDate(profile?.created_at)}
            </span>
          </div>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '12px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#6366f1' }}>{downloads.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Downloads</div>
        </div>
      </div>

      {/* Download History */}
      <h3 style={{ fontSize: '1.3rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Download size={20} color="#6366f1" /> Download History
      </h3>

      {downloads.length === 0 ? (
        <div className="glass" style={{ padding: '4rem', textAlign: 'center' }}>
          <Package size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)' }}>You haven't downloaded anything yet.</p>
          <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1.5rem', padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutGrid size={18} /> Browse Store
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {downloads.map((dl) => (
            <div key={dl.id} className="glass" style={{ padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {dl.apps?.icon_url ? (
                  <img src={dl.apps.icon_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }} />
                ) : <LayoutGrid size={22} color="#6366f1" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{dl.apps?.name || 'Unknown App'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dl.apps?.version} · {dl.apps?.size}</div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                {formatDate(dl.downloaded_at)}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Logout Confirmation */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title="Logout?"
        message="Are you sure you want to log out from CStore?"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
        type="danger"
        confirmText="Yes, Logout"
        cancelText="Stay"
      />
    </div>
  );
};

export default UserDashboard;
