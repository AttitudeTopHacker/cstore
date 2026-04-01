import {
  Users, Package, Download, Trash2, Upload, LogOut, LayoutGrid,
  ShieldCheck, AlertCircle, CheckCircle, Loader2, RefreshCw, File, Image as ImageIcon,
  UserX, UserCheck, Store
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import ConfirmModal from '../components/ConfirmModal';

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
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

  // Upload form state
  const [formData, setFormData] = useState({ name: '', version: '', description: '' });
  const [files, setFiles] = useState({ app: null, icon: null });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, appsRes, usersRes] = await Promise.all([
        fetch(`${config.API_BASE_URL}/admin/stats`, { headers }),
        fetch(`${config.API_BASE_URL}/apps`),
        fetch(`${config.API_BASE_URL}/admin/users`, { headers }),
      ]);
      setStats(await statsRes.json());
      setApps(await appsRes.json());
      setUsers(await usersRes.json());
    } catch (err) { console.error(err); }
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
    if (!files.app) return setActionStatus({ loading: false, success: null, error: 'App file required!' });
    setActionStatus({ loading: true, success: null, error: null });
    const data = new FormData();
    data.append('name', formData.name);
    data.append('version', formData.version);
    data.append('description', formData.description);
    data.append('file', files.app);
    if (files.icon) data.append('icon', files.icon);
    try {
      const res = await fetch(`${config.API_BASE_URL}/upload`, { method: 'POST', headers, body: data });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setActionStatus({ loading: false, success: 'App uploaded successfully!', error: null });
      setFormData({ name: '', version: '', description: '' });
      setFiles({ app: null, icon: null });
      fetchAll();
    } catch (err) {
      setActionStatus({ loading: false, success: null, error: err.message });
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
          </div>
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
          <div className="glass" style={{ overflow: 'hidden', borderRadius: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['Name', 'Email', 'Role', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 5).map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{u.email}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <button onClick={() => handleDeleteApp(app.id)}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === TAB.USERS && (
        <div>
          <div className="glass" style={{ overflow: 'auto', borderRadius: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['Name', 'Email', 'Apps', 'Store', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No users registered yet.</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        {u.name}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{u.email}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--primary)' }}>
                        <Package size={14} /> {u.apps_count}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {u.apps_count === 0 ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b', fontSize: '0.8rem' }}>
                          <AlertCircle size={14} /> Empty
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontSize: '0.8rem' }}>
                          <Store size={14} /> Active
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ 
                        background: u.status === 'suspended' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', 
                        color: u.status === 'suspended' ? '#ef4444' : '#10b981',
                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDate(u.created_at)}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleStatusToggle(u.id, u.status)}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: u.status === 'suspended' ? '#10b981' : '#f59e0b', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {u.status === 'suspended' ? <UserCheck size={14} /> : <UserX size={14} />}
                          <span style={{ fontSize: '0.8rem' }}>{u.status === 'suspended' ? 'Unsuspend' : 'Suspend'}</span>
                        </button>
                        <button onClick={() => handleDeleteUser(u.id)}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {activeTab === TAB.UPLOAD && (
        <div style={{ maxWidth: '720px' }}>
          <form onSubmit={handleUpload} className="glass" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>App Name *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Version (e.g. v1.0.0)</label>
                <input type="text" value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Description</label>
              <textarea rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* App File */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>App File (APK/IPA) *</label>
                <div style={{ background: 'rgba(99,102,241,0.05)', border: '2px dashed var(--primary)', borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                  <input type="file" accept=".apk,.ipa,.exe,.dmg,.zip" required onChange={e => setFiles({ ...files, app: e.target.files[0] })}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                  <File size={28} color="var(--primary)" style={{ marginBottom: '0.5rem' }} />
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{files.app ? files.app.name : 'Click to select'}</p>
                </div>
              </div>
              {/* Icon File */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Icon (Optional)</label>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed var(--glass-border)', borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                  <input type="file" accept="image/*" onChange={e => setFiles({ ...files, icon: e.target.files[0] })}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                  <ImageIcon size={28} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{files.icon ? files.icon.name : 'Click to select'}</p>
                </div>
              </div>
            </div>

            {actionStatus.error && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><AlertCircle size={16} />{actionStatus.error}</div>}
            {actionStatus.success && <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><CheckCircle size={16} />{actionStatus.success}</div>}

            <button type="submit" disabled={actionStatus.loading} className="btn-primary"
              style={{ padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontSize: '1rem' }}>
              {actionStatus.loading ? <><Loader2 size={20} className="animate-spin" /> Uploading...</> : <><Upload size={20} /> Publish Application</>}
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
    </div>
  );
};

export default AdminDashboard;
