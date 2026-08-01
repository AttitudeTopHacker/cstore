import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  Users, Package, Download, Trash2, Upload, LogOut, LayoutGrid,
  ShieldCheck, AlertCircle, CheckCircle, Loader2, RefreshCw, File, Image as ImageIcon,
  UserX, UserCheck, Store
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import ConfirmModal from '../components/ConfirmModal';
import UpdateAppModal from '../components/UpdateAppModal';

const TAB = { OVERVIEW: 'overview', APPS: 'apps', USERS: 'users', UPLOAD: 'upload' };

const AdminDashboard = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TAB.OVERVIEW);
  const [stats, setStats] = useState(null);
  const [apps, setApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState({ loading: false, success: null, error: null });
  const [fetchError, setFetchError] = useState(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedAppForUpdate, setSelectedAppForUpdate] = useState(null);

  // Upload form state
  const [formData, setFormData] = useState({ name: '', version: '', description: '', size: '' });
  const [files, setFiles] = useState({ icon: null, apk: null });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, appsRes, usersRes] = await Promise.all([
        fetch(`${config.API_BASE_URL}/admin/stats`, { headers }),
        fetch(`${config.API_BASE_URL}/apps`),
        fetch(`${config.API_BASE_URL}/admin/users`, { headers }),
      ]);

      const statsData = await statsRes.json();
      const appsData = await appsRes.json();
      const usersData = await usersRes.json();

      if (statsRes.ok) setStats(statsData);
      if (appsRes.ok && Array.isArray(appsData)) setApps(appsData);
      if (usersRes.ok && Array.isArray(usersData)) setUsers(usersData);
      
      if (!statsRes.ok || !appsRes.ok || !usersRes.ok) {
        setFetchError(`Server Error: ${statsRes.status} | ${appsRes.status} | ${usersRes.status}`);
      }
    } catch (err) { 
      console.error('Fetch error:', err);
      setFetchError(`Network Error: ${err.message}. Please check your internet connection or backend status.`);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [token]);

  const handleDeleteApp = async (id) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete App?',
      message: 'Are you sure you want to permanently delete this application? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`${config.API_BASE_URL}/admin/apps/${id}`, { method: 'DELETE', headers });
          if (!res.ok) throw new Error('Delete failed');
          setApps(apps.filter(a => a.id !== id));
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) { alert(err.message); }
      }
    });
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    setModalConfig({
      isOpen: true,
      title: `${newStatus === 'suspended' ? 'Suspend' : 'Activate'} User?`,
      message: `Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 're-activate'} this user's account?`,
      type: newStatus === 'suspended' ? 'danger' : 'primary',
      onConfirm: async () => {
        try {
          const res = await fetch(`${config.API_BASE_URL}/admin/users/${userId}/status`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) throw new Error('Status update failed');
          setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) { alert(err.message); }
      }
    });
  };

  const handleDeleteUser = async (id) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete User?',
      message: 'Are you sure you want to permanently delete this user and all their uploaded apps? This is irreversible.',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`${config.API_BASE_URL}/admin/users/${id}`, { method: 'DELETE', headers });
          if (!res.ok) throw new Error('Delete failed');
          setUsers(users.filter(u => u.id !== id));
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) { alert(err.message); }
      }
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.apk) return setActionStatus({ loading: false, success: null, error: 'Please select an APK file!' });
    setActionStatus({ loading: true, success: null, error: null });

    try {
      let finalFileUrl = '';
      
      // 1. Upload Icon (Optional)
      let iconUrl = null;
      if (files.icon) {
        const iconFileName = `${Date.now()}-${files.icon.name.replace(/\s+/g, '_')}`;
        const { error: iconError } = await supabase.storage.from('cstore-icons').upload(iconFileName, files.icon);
        if (iconError) throw iconError;
        const { data: { publicUrl } } = supabase.storage.from('cstore-icons').getPublicUrl(iconFileName);
        iconUrl = publicUrl;
      }

      // 2. Upload APK
      const apkFileName = `${Date.now()}-${files.apk.name.replace(/\s+/g, '_')}`;
      const { error: apkError } = await supabase.storage.from('cstore-apps').upload(apkFileName, files.apk);
      if (apkError) throw apkError;
      const { data: { publicUrl: apkPublicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(apkFileName);
      finalFileUrl = apkPublicUrl;

      // 3. Send metadata to backend
      const res = await fetch(`${config.API_BASE_URL}/upload`, { 
        method: 'POST', 
        headers: { ...headers, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          name: formData.name,
          version: formData.version,
          description: formData.description,
          file_url: finalFileUrl,
          icon_url: iconUrl,
          size: formData.size || 'Unknown',
          is_chunked: false,
          chunk_count: 1
        })
      });

      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setActionStatus({ loading: false, success: 'App published successfully!', error: null });
      setFormData({ name: '', version: '', description: '', size: '' });
      setFiles({ icon: null, apk: null });
      fetchAll();
    } catch (err) {
      setActionStatus({ loading: false, success: null, error: err.message });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (e.target.name === 'apk' && file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setFormData(prev => ({ ...prev, size: `${sizeMB} MB` }));
      setFiles({ ...files, apk: file });
    } else {
      setFiles({ ...files, [e.target.name]: file });
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const tabStyle = (tab) => ({
    padding: '10px 22px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: 600, fontSize: '0.9rem', border: 'none', transition: 'all 0.2s',
    background: activeTab === tab ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
    color: activeTab === tab ? 'white' : 'var(--text-muted)',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    boxShadow: activeTab === tab ? '0 4px 15px rgba(99,102,241,0.3)' : 'none',
  });

  return (
    <div style={{ padding: '2.5rem 0' }}>
      {/* Header - Always Visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <ShieldCheck size={28} color="#6366f1" />
            <h1 style={{ fontSize: '2.2rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Admin Panel
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Full control over CStore</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate('/')} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit', fontWeight: 600 }}>
            <LayoutGrid size={16} /> Visit Store
          </button>
          <button onClick={fetchAll} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit' }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button 
            onClick={() => setModalConfig({
              isOpen: true,
              title: 'Logout?',
              message: 'Are you sure you want to log out from the Admin Panel?',
              type: 'danger',
              onConfirm: handleLogout
            })}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit', fontWeight: 600 }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <Loader2 size={40} className="animate-spin" style={{ marginBottom: '1rem', color: 'var(--primary)' }} />
            <p>Loading Dashboard...</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>Connecting to: {config.API_BASE_URL}</p>
          </div>
        </div>
      ) : fetchError ? (
        <div className="glass" style={{ padding: '3rem', textAlign: 'center', margin: '2rem 0', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Failed to Load Dashboard</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{fetchError}</p>
          <button onClick={fetchAll} className="btn-primary">Try Again</button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button style={tabStyle(TAB.OVERVIEW)} onClick={() => setActiveTab(TAB.OVERVIEW)}><LayoutGrid size={16} /> Overview</button>
            <button style={tabStyle(TAB.APPS)} onClick={() => setActiveTab(TAB.APPS)}><Package size={16} /> Apps ({apps.length})</button>
            <button style={tabStyle(TAB.USERS)} onClick={() => setActiveTab(TAB.USERS)}><Users size={16} /> Users ({users.length})</button>
            <button style={tabStyle(TAB.UPLOAD)} onClick={() => setActiveTab(TAB.UPLOAD)}><Upload size={16} /> Upload App</button>
          </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === TAB.OVERVIEW && (
        <div>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {[
              { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: <Users size={24} />, color: '#6366f1' },
              { label: 'Total Apps', value: stats?.totalApps ?? 0, icon: <Package size={24} />, color: '#a855f7' },
              { label: 'Total Downloads', value: stats?.totalDownloads ?? 0, icon: <Download size={24} />, color: '#10b981' },
            ].map((s) => (
              <div key={s.label} className="glass" style={{ padding: '1.75rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Users */}
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} color="#6366f1" /> Recent Users
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {users.slice(0, 5).map((u) => (
              <div key={u.id} className="glass" style={{ padding: '1rem 1.25rem', borderRadius: '14px' }}>
                {[
                  { label: 'Name',   value: u.name },
                  { label: 'Email',  value: u.email },
                  { label: 'Role',   value: u.role, isBadge: true },
                  { label: 'Joined', value: formatDate(u.created_at) },
                ].map(({ label, value, isBadge }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, minWidth: '60px' }}>{label}</span>
                    {isBadge
                      ? <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>{value}</span>
                      : <span style={{ fontSize: '0.88rem', color: 'white', textAlign: 'right', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                    }
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── APPS TAB ── */}
      {activeTab === TAB.APPS && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {apps.length === 0 && <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No apps uploaded yet.</div>}
            {apps.map((app) => (
              <div key={app.id} className="glass" style={{ padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(99,102,241,0.1)', flexShrink: 0 }}>
                  {app.icon_url ? <img src={app.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LayoutGrid size={26} color="#6366f1" style={{ margin: '13px' }} />}
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{app.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.version} · {app.size}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#6366f1', fontSize: '1.25rem' }}>{app.download_count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Downloads</div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(app.created_at)}</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setSelectedAppForUpdate(app); setIsUpdateModalOpen(true); }}
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                    <RefreshCw size={15} /> Update
                  </button>
                  <button onClick={() => handleDeleteApp(app.id)}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === TAB.USERS && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {users.length === 0 && (
            <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', borderRadius: '16px' }}>No users registered yet.</div>
          )}
          {users.map((u) => (
            <div key={u.id} className="glass" style={{ padding: '1.1rem 1.4rem', borderRadius: '16px' }}>
              {[
                { label: 'Name',   value: u.name },
                { label: 'Email',  value: u.email },
                { label: 'Role',   value: u.role,            isBadge: true, badgeColor: '#a5b4fc', badgeBg: 'rgba(99,102,241,0.15)' },
                { label: 'Joined', value: formatDate(u.created_at) },
              ].map(({ label, value, isBadge, badgeColor, badgeBg }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, minWidth: '64px' }}>{label}</span>
                  {isBadge
                    ? <span style={{ background: badgeBg, color: badgeColor, padding: '2px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>{value}</span>
                    : <span style={{ fontSize: '0.88rem', color: 'white', textAlign: 'right', maxWidth: '68%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                  }
                </div>
              ))}
              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                <button onClick={() => handleStatusToggle(u.id, u.status)}
                  style={{ flex: 1, background: u.status === 'suspended' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${u.status === 'suspended' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, color: u.status === 'suspended' ? '#10b981' : '#f59e0b', padding: '8px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600 }}>
                  {u.status === 'suspended' ? <UserCheck size={14} /> : <UserX size={14} />}
                  {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                </button>
                <button onClick={() => handleDeleteUser(u.id)}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '8px 14px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600 }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {activeTab === TAB.UPLOAD && (
        <div style={{ maxWidth: '800px' }}>
          <form onSubmit={handleUpload} className="glass" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>App Name *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Version (e.g. v1.0.0)</label>
                <input type="text" value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Description</label>
              <textarea rows="4" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Application APK File *</label>
              <div 
                className="glass"
                style={{ 
                  position: 'relative',
                  background: 'rgba(255,255,255,0.02)', 
                  border: '2px dashed var(--glass-border)', 
                  borderRadius: '20px', 
                  padding: '3rem 2rem', 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                onDrop={(e) => { 
                  e.preventDefault(); 
                  e.currentTarget.style.borderColor = 'var(--glass-border)'; 
                  const file = e.dataTransfer.files[0];
                  if (file && file.name.endsWith('.apk')) {
                    handleFileChange({ target: { name: 'apk', files: [file] } });
                  }
                }}
              >
                <input type="file" name="apk" accept=".apk" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <File size={28} style={{ color: 'var(--primary)' }} />
                </div>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>{files.apk ? files.apk.name : 'Pick or Drag APK here'}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{files.apk ? `Size: ${formData.size}` : 'Maximum file size: 500MB'}</p>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Icon (Optional)</label>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed var(--glass-border)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                <input type="file" name="icon" accept="image/*" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                <ImageIcon size={24} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{files.icon ? files.icon.name : 'Click to select icon image'}</p>
              </div>
            </div>

            {actionStatus.error && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><AlertCircle size={16} />{actionStatus.error}</div>}
            {actionStatus.success && <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><CheckCircle size={16} />{actionStatus.success}</div>}

            <button type="submit" disabled={actionStatus.loading} className="btn-primary"
              style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', fontSize: '1.1rem' }}>
              {actionStatus.loading ? <><Loader2 size={24} className="animate-spin" /> Publishing...</> : <><Upload size={24} /> Publish Application</>}
            </button>
          </form>
        </div>
      )}
        </>
      )}
      
      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        type={modalConfig.type}
      />
      
      {/* Update App Modal */}
      <UpdateAppModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        app={selectedAppForUpdate}
        token={token}
        onSuccess={fetchAll}
      />
    </div>
  );
};

export default AdminDashboard;
