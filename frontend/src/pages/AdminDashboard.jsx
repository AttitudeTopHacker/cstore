import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  Users, Package, Download, Trash2, Upload, LogOut, LayoutGrid,
  ShieldCheck, AlertCircle, CheckCircle, Loader2, RefreshCw, File, Image as ImageIcon,
  UserX, UserCheck, Store, Sparkles, Rocket, Plus, ExternalLink, Github, GitBranch
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import UpdateAppModal from '../components/UpdateAppModal';

const TAB = { 
  OVERVIEW: 'overview', 
  APPS: 'apps', 
  USERS: 'users', 
  TEAM: 'team', 
  UPCOMING: 'upcoming', 
  UPLOAD: 'upload' 
};

const AdminDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TAB.OVERVIEW);
  const [stats, setStats] = useState(null);
  const [apps, setApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [upcomingList, setUpcomingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState({ loading: false, success: null, error: null });
  const [fetchError, setFetchError] = useState(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedAppForUpdate, setSelectedAppForUpdate] = useState(null);

  // Helper to detect if an app was published via GitHub Actions vs Manual
  const isGitHubSource = (app) => {
    if (!app) return false;
    if (app.upload_source === 'github') return true;
    if (app.upload_source === 'manual') return false;
    if (app.description && (app.description.includes('GitHub Actions') || app.description.includes('CI/CD'))) return true;
    if (app.publisher_name && app.publisher_name.toLowerCase().includes('github')) return true;
    return false;
  };

  // Publish Upcoming Release Modal State (Admin Superuser Launch)
  const [publishModal, setPublishModal] = useState({
    isOpen: false,
    item: null,
    file: null,
    loading: false,
    error: '',
    progress: 0
  });

  // Upload form state
  const [formData, setFormData] = useState({ name: '', version: '', description: '', size: '' });
  const [files, setFiles] = useState({ icon: null, apk: null });

  // Core Team form state
  const [teamForm, setTeamForm] = useState({
    name: '',
    github_username: '',
    role: '',
    bio: '',
    tech_stack: 'React, Android, Supabase',
    is_lead: false,
    display_order: 1
  });

  // Upcoming Release form state
  const [upcomingForm, setUpcomingForm] = useState({
    app_name: '',
    tagline: '',
    description: '',
    version: 'v1.0.0',
    estimated_release: 'Coming Soon',
    progress: 50,
    github_repo_url: '',
    icon_url: '',
    is_update: false,
    existing_app_id: null
  });
  const [upcomingIconFile, setUpcomingIconFile] = useState(null);
  const [upcomingIconPreview, setUpcomingIconPreview] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const [appsRes, usersRes, teamRes, upcomingRes] = await Promise.all([
        supabase.from('apps').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('core_team').select('*').order('display_order', { ascending: true }),
        supabase.from('upcoming_releases').select('*').order('created_at', { ascending: false })
      ]);

      if (appsRes.error) throw appsRes.error;
      const loadedApps = appsRes.data || [];
      const loadedUsers = usersRes.data || [];
      const loadedTeam = teamRes.data || [];
      const loadedUpcoming = upcomingRes.data || [];
      const totalDownloads = loadedApps.reduce((acc, a) => acc + (a.download_count || 0), 0);

      setApps(loadedApps);
      setUsers(loadedUsers);
      setTeamMembers(loadedTeam);
      setUpcomingList(loadedUpcoming);

      setStats({
        total_apps: loadedApps.length,
        total_users: loadedUsers.length,
        total_downloads: totalDownloads,
        total_team: loadedTeam.length,
        total_upcoming: loadedUpcoming.filter(u => !u.is_published).length
      });
    } catch (err) {
      console.error('AdminDashboard load error:', err);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
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
          const { error: delErr } = await supabase.from('apps').delete().eq('id', id);
          if (delErr) throw delErr;
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
          const { error: patchErr } = await supabase.from('users').update({ status: newStatus }).eq('id', userId);
          if (patchErr) throw patchErr;
          setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) { alert(err.message); }
      }
    });
  };

  // Add Core Team Member
  const handleAddTeamMember = async (e) => {
    e.preventDefault();
    if (!teamForm.name || !teamForm.github_username || !teamForm.role) {
      alert('Please fill out Name, GitHub Username, and Role.');
      return;
    }
    setActionStatus({ loading: true, success: null, error: null });
    try {
      const techArray = teamForm.tech_stack
        ? teamForm.tech_stack.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      
      const { error: insertErr } = await supabase.from('core_team').insert([{
        name: teamForm.name,
        github_username: teamForm.github_username.replace('@', '').trim(),
        role: teamForm.role,
        bio: teamForm.bio,
        tech_stack: techArray,
        is_lead: teamForm.is_lead,
        display_order: parseInt(teamForm.display_order, 10) || 0,
        avatar_url: `https://github.com/${teamForm.github_username.replace('@', '').trim()}.png`
      }]);

      if (insertErr) throw insertErr;

      setActionStatus({ loading: false, success: 'Core Team member added successfully!', error: null });
      setTeamForm({ name: '', github_username: '', role: '', bio: '', tech_stack: 'React, Android, Supabase', is_lead: false, display_order: 1 });
      fetchAll();
    } catch (err) {
      setActionStatus({ loading: false, success: null, error: err.message });
    }
  };

  // Delete Core Team Member
  const handleDeleteTeamMember = async (id, memberName) => {
    setModalConfig({
      isOpen: true,
      title: `Remove ${memberName}?`,
      message: 'Are you sure you want to remove this contributor from the Core Team showcase?',
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('core_team').delete().eq('id', id);
          if (error) throw error;
          setTeamMembers(prev => prev.filter(m => m.id !== id));
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert(err.message);
        }
      }
    });
  };

  // Add Upcoming Release
  const handleAddUpcoming = async (e) => {
    e.preventDefault();
    if (!upcomingForm.app_name) {
      alert('Please provide an App Name.');
      return;
    }
    setActionStatus({ loading: true, success: null, error: null });
    try {
      let iconUrl = upcomingForm.icon_url || null;

      if (upcomingIconFile) {
        const cleanName = upcomingIconFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const iconFileName = `icons/${Date.now()}_${cleanName}`;
        const { error: iconError } = await supabase.storage.from('cstore-icons').upload(iconFileName, upcomingIconFile, { upsert: true });
        if (!iconError) {
          const { data: { publicUrl } } = supabase.storage.from('cstore-icons').getPublicUrl(iconFileName);
          iconUrl = publicUrl;
        } else {
          const { error: appErr } = await supabase.storage.from('cstore-apps').upload(iconFileName, upcomingIconFile, { upsert: true });
          if (!appErr) {
            const { data: { publicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(iconFileName);
            iconUrl = publicUrl;
          }
        }
      }

      const { error } = await supabase.from('upcoming_releases').insert([{
        app_name: upcomingForm.app_name,
        tagline: upcomingForm.tagline || '',
        description: upcomingForm.description || '',
        version: upcomingForm.version || 'v1.0.0',
        estimated_release: upcomingForm.estimated_release || 'Coming Soon',
        target_date: upcomingForm.estimated_release || 'Coming Soon',
        progress: parseInt(upcomingForm.progress, 10) || 50,
        github_repo_url: upcomingForm.github_repo_url || null,
        icon_url: iconUrl,
        is_update: !!upcomingForm.is_update,
        existing_app_id: upcomingForm.existing_app_id || null,
        created_by: user?.id || null,
        creator_email: user?.email || null,
        creator_name: user?.name || null,
        is_published: false
      }]);

      if (error) throw error;

      setActionStatus({ loading: false, success: 'Upcoming release teaser created!', error: null });
      setUpcomingForm({ app_name: '', tagline: '', description: '', version: 'v1.0.0', estimated_release: 'Coming Soon', progress: 50, github_repo_url: '', icon_url: '', is_update: false, existing_app_id: null });
      setUpcomingIconFile(null);
      setUpcomingIconPreview(null);
      fetchAll();
    } catch (err) {
      setActionStatus({ loading: false, success: null, error: err.message });
    }
  };

  // Delete Upcoming Release
  const handleDeleteUpcoming = async (id, name) => {
    setModalConfig({
      isOpen: true,
      title: `Remove ${name}?`,
      message: 'Are you sure you want to remove this upcoming release teaser?',
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('upcoming_releases').delete().eq('id', id);
          if (error) throw error;
          setUpcomingList(prev => prev.filter(u => u.id !== id));
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert(err.message);
        }
      }
    });
  };

  // Admin Launch / Upload APK for any Teaser
  const handlePublishUpcoming = async (e) => {
    e.preventDefault();
    if (!publishModal.file || !publishModal.item) return;

    setPublishModal(prev => ({ ...prev, loading: true, error: '' }));
    const releaseItem = publishModal.item;
    const apkFile = publishModal.file;

    try {
      const CHUNK_SIZE = 9 * 1024 * 1024;
      const totalChunks = Math.ceil(apkFile.size / CHUNK_SIZE);
      const isChunked = totalChunks > 1;
      const fileId = `${Date.now()}_${apkFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      let finalFileUrl = '';

      if (isChunked) {
        const urlBase = `chunked_${fileId}`;
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, apkFile.size);
          const chunkBlob = apkFile.slice(start, end);
          const chunkPath = `${urlBase}_part_${i}`;

          const { error: chunkErr } = await supabase.storage
            .from('cstore-apps')
            .upload(chunkPath, chunkBlob, { upsert: true });

          if (chunkErr) throw chunkErr;
          setPublishModal(prev => ({ ...prev, progress: Math.round(((i + 1) / totalChunks) * 100) }));
        }

        const { data: { publicUrl } } = supabase.storage
          .from('cstore-apps')
          .getPublicUrl(urlBase);
        finalFileUrl = publicUrl;
      } else {
        const filePath = `${Date.now()}-${apkFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('cstore-apps')
          .upload(filePath, apkFile, { upsert: true });

        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage
          .from('cstore-apps')
          .getPublicUrl(filePath);
        finalFileUrl = publicUrl;
      }

      const sizeMB = (apkFile.size / (1024 * 1024)).toFixed(1) + ' MB';

      if (releaseItem.is_update && releaseItem.existing_app_id) {
        // App Update Flow: Archive old version & update existing app
        const { data: currentApp } = await supabase
          .from('apps')
          .select('*')
          .eq('id', releaseItem.existing_app_id)
          .single();

        if (currentApp) {
          try {
            await supabase.from('app_versions').insert([{
              app_id: currentApp.id,
              version: currentApp.version,
              file_url: currentApp.file_url,
              size: currentApp.size,
              changelog: `Updated to ${releaseItem.version}`
            }]);
          } catch (_) {}
        }

        const { error: appUpdateErr } = await supabase
          .from('apps')
          .update({
            version: releaseItem.version,
            description: releaseItem.description || currentApp?.description,
            file_url: finalFileUrl,
            size: sizeMB,
            is_chunked: isChunked,
            chunk_count: totalChunks,
            updated_by_admin: true,
            last_updated_by: `Admin (${user?.email || 'mohdsalman4151@gmail.com'})`,
            updated_at: new Date().toISOString()
          })
          .eq('id', releaseItem.existing_app_id);

        if (appUpdateErr) throw appUpdateErr;
      } else {
        // Brand New App Flow: Insert into live apps
        const { error: appInsertErr } = await supabase
          .from('apps')
          .insert([{
            name: releaseItem.app_name,
            version: releaseItem.version,
            description: releaseItem.description,
            file_url: finalFileUrl,
            icon_url: releaseItem.icon_url || null,
            size: sizeMB,
            is_chunked: isChunked,
            chunk_count: totalChunks,
            user_id: releaseItem.created_by || user?.id || null,
            publisher_name: releaseItem.creator_email?.split('@')[0] || user?.name || 'Mohd Salman (Movin)',
            publisher_email: releaseItem.creator_email || user?.email || 'mohdsalman4151@gmail.com'
          }]);

        if (appInsertErr) throw appInsertErr;
      }

      // Mark Upcoming Release as published
      const { error: markErr } = await supabase
        .from('upcoming_releases')
        .update({ is_published: true })
        .eq('id', releaseItem.id);

      if (markErr) console.warn('Could not mark upcoming as published:', markErr);

      setPublishModal({ isOpen: false, item: null, file: null, loading: false, error: '', progress: 0 });
      fetchAll();
    } catch (err) {
      console.error('Admin publish upcoming error:', err);
      setPublishModal(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  // Direct Supabase App Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!files.apk) {
      setActionStatus({ loading: false, success: null, error: 'Please select an APK file' });
      return;
    }

    setActionStatus({ loading: true, success: null, error: null });

    try {
      let iconUrl = null;
      let finalFileUrl = null;

      if (files.icon) {
        const iconFileName = `icons/${Date.now()}-${files.icon.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: iconError } = await supabase.storage.from('cstore-apps').upload(iconFileName, files.icon, { upsert: true });
        if (iconError) throw iconError;
        const { data: { publicUrl: iconPublicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(iconFileName);
        iconUrl = iconPublicUrl;
      }

      const apkFileName = `${Date.now()}-${files.apk.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: apkError } = await supabase.storage.from('cstore-apps').upload(apkFileName, files.apk, { upsert: true });
      if (apkError) throw apkError;
      const { data: { publicUrl: apkPublicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(apkFileName);
      finalFileUrl = apkPublicUrl;

      const { error: dbError } = await supabase.from('apps').insert([{
        name: formData.name,
        version: formData.version || 'v1.0.0',
        description: formData.description || '',
        file_url: finalFileUrl,
        icon_url: iconUrl,
        download_count: 0,
        size: formData.size || 'Unknown',
        is_chunked: false,
        chunk_count: 1,
        user_id: user?.id || null,
        publisher_name: user?.name || 'Mohd Salman (Movin)',
        publisher_email: user?.email || 'mohdsalman4151@gmail.com'
      }]);
      if (dbError) throw dbError;

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
    padding: '9px 18px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: 600, fontSize: '0.88rem', border: 'none', transition: 'all 0.2s',
    background: activeTab === tab ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
    color: activeTab === tab ? 'white' : 'var(--text-muted)',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    boxShadow: activeTab === tab ? '0 4px 15px rgba(99,102,241,0.3)' : 'none',
  });

  return (
    <div style={{ padding: '2.5rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <ShieldCheck size={28} color="#6366f1" />
            <h1 style={{ fontSize: '2.2rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              Admin Panel
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Full control over CStore ecosystem</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate('/')} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit', fontWeight: 600 }}>
            <LayoutGrid size={16} /> Visit Store
          </button>
          <button onClick={fetchAll} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit' }}>
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
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit', fontWeight: 600 }}
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
          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button style={tabStyle(TAB.OVERVIEW)} onClick={() => setActiveTab(TAB.OVERVIEW)}><LayoutGrid size={15} /> Overview</button>
            <button style={tabStyle(TAB.APPS)} onClick={() => setActiveTab(TAB.APPS)}><Package size={15} /> Apps ({apps.length})</button>
            <button style={tabStyle(TAB.TEAM)} onClick={() => setActiveTab(TAB.TEAM)}><Users size={15} /> Core Team ({teamMembers.length})</button>
            <button style={tabStyle(TAB.UPCOMING)} onClick={() => setActiveTab(TAB.UPCOMING)}><Rocket size={15} /> Teasers ({upcomingList.length})</button>
            <button style={tabStyle(TAB.USERS)} onClick={() => setActiveTab(TAB.USERS)}><UserCheck size={15} /> Users ({users.length})</button>
            <button style={tabStyle(TAB.UPLOAD)} onClick={() => setActiveTab(TAB.UPLOAD)}><Upload size={15} /> Upload App</button>
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === TAB.OVERVIEW && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                {[
                  { label: 'Total Apps', value: stats?.total_apps ?? 0, icon: <Package size={22} />, color: '#a855f7' },
                  { label: 'Total Downloads', value: stats?.total_downloads ?? 0, icon: <Download size={22} />, color: '#10b981' },
                  { label: 'Core Team', value: stats?.total_team ?? 0, icon: <Users size={22} />, color: '#6366f1' },
                  { label: 'Active Teasers', value: stats?.total_upcoming ?? 0, icon: <Rocket size={22} />, color: '#f59e0b' },
                  { label: 'Total Users', value: stats?.total_users ?? 0, icon: <UserCheck size={22} />, color: '#38bdf8' },
                ].map((s) => (
                  <div key={s.label} className="glass" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${s.color}1a`, border: `1px solid ${s.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                      {s.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white' }}>{s.value}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Apps */}
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'white' }}>Latest Applications</h3>
              <div className="glass" style={{ padding: '1rem', overflowX: 'auto', borderRadius: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '550px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '10px 14px' }}>App Name</th>
                      <th style={{ padding: '10px 14px' }}>Version</th>
                      <th style={{ padding: '10px 14px' }}>Size</th>
                      <th style={{ padding: '10px 14px' }}>Downloads</th>
                      <th style={{ padding: '10px 14px' }}>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.slice(0, 5).map(app => (
                      <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'white' }}>{app.name}</td>
                        <td style={{ padding: '12px 14px', color: '#a5b4fc' }}>{app.version}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{app.size}</td>
                        <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 600 }}>{app.download_count}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatDate(app.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── APPS TAB ── */}
          {activeTab === TAB.APPS && (
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>All Published Applications ({apps.length})</h3>
                <button onClick={() => setActiveTab(TAB.UPLOAD)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Plus size={15} /> Add New App
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '10px 14px' }}>Name</th>
                    <th style={{ padding: '10px 14px' }}>Version</th>
                    <th style={{ padding: '10px 14px' }}>Source</th>
                    <th style={{ padding: '10px 14px' }}>Published By</th>
                    <th style={{ padding: '10px 14px' }}>Size</th>
                    <th style={{ padding: '10px 14px' }}>Downloads</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3, 4, 5].map(n => (
                      <tr key={n} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0 }} />
                            <div className="skeleton-shimmer" style={{ height: '16px', width: '120px', borderRadius: '4px' }} />
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer" style={{ height: '14px', width: '50px', borderRadius: '4px' }} /></td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer" style={{ height: '18px', width: '85px', borderRadius: '6px' }} /></td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer" style={{ height: '14px', width: '110px', borderRadius: '4px' }} /></td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer" style={{ height: '14px', width: '45px', borderRadius: '4px' }} /></td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer" style={{ height: '14px', width: '35px', borderRadius: '4px' }} /></td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}><div className="skeleton-shimmer" style={{ height: '28px', width: '90px', borderRadius: '8px', marginLeft: 'auto' }} /></td>
                      </tr>
                    ))
                  ) : apps.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No applications available in database.
                      </td>
                    </tr>
                  ) : (
                    apps.map(app => {
                    const pubUser = users.find(u => u.id === app.user_id) || (app.publisher_email ? users.find(u => u.email === app.publisher_email) : null);
                    const publisherName = app.publisher_name || pubUser?.name || 'Mohd Salman (Movin)';
                    const publisherEmail = app.publisher_email || pubUser?.email || 'mohdsalman4151@gmail.com';

                    return (
                      <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'white' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {app.icon_url && <img src={app.icon_url} alt="" style={{ width: '28px', height: '28px', borderRadius: '7px', objectFit: 'cover' }} />}
                            <span>{app.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#a5b4fc', fontWeight: 600 }}>{app.version}</td>
                        <td style={{ padding: '12px 14px' }}>
                          {isGitHubSource(app) ? (
                            <span 
                              style={{ 
                                fontSize: '0.72rem', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                background: 'rgba(99, 102, 241, 0.15)', 
                                color: '#a5b4fc', 
                                border: '1px solid rgba(99, 102, 241, 0.35)', 
                                fontWeight: 700, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px' 
                              }}
                              title="Deployed via GitHub Actions CI/CD"
                            >
                              <GitBranch size={11} /> GitHub CI/CD
                            </span>
                          ) : (
                            <span 
                              style={{ 
                                fontSize: '0.72rem', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                background: 'rgba(56, 189, 248, 0.12)', 
                                color: '#38bdf8', 
                                border: '1px solid rgba(56, 189, 248, 0.28)', 
                                fontWeight: 700, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px' 
                              }}
                              title="Uploaded manually via Web Form"
                            >
                              <Upload size={11} /> Manual Upload
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>
                              {publisherName}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {publisherEmail}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{app.size}</td>
                        <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 600 }}>{app.download_count}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => { setSelectedAppForUpdate(app); setIsUpdateModalOpen(true); }}
                              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Update
                            </button>
                            <button
                              onClick={() => handleDeleteApp(app.id)}
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── CORE TEAM MANAGEMENT TAB ── */}
          {activeTab === TAB.TEAM && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.3fr)', gap: '2rem' }}>
              
              {/* Form: Add Core Team Member */}
              <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={18} color="#6366f1" /> Add Team Member
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Add a verified developer or core architect to the Concept 2 Explore and Developers showcase.
                </p>

                <form onSubmit={handleAddTeamMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Mohd Salman"
                      value={teamForm.name}
                      onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                      required
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>GitHub Username</label>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="e.g. AttitudeTopHacker"
                        value={teamForm.github_username}
                        onChange={e => setTeamForm({ ...teamForm, github_username: e.target.value })}
                        required
                        style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                      />
                      {teamForm.github_username && (
                        <img
                          src={`https://github.com/${teamForm.github_username.replace('@', '').trim()}.png`}
                          alt="Avatar preview"
                          referrerPolicy="no-referrer"
                          style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid var(--primary)', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Role / Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Lead Architect & Fullstack Engineer"
                      value={teamForm.role}
                      onChange={e => setTeamForm({ ...teamForm, role: e.target.value })}
                      required
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tech Stack (Comma Separated)</label>
                    <input
                      type="text"
                      placeholder="React, Android, Supabase, Node.js"
                      value={teamForm.tech_stack}
                      onChange={e => setTeamForm({ ...teamForm, tech_stack: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bio / Description</label>
                    <textarea
                      placeholder="Brief developer background..."
                      rows={3}
                      value={teamForm.bio}
                      onChange={e => setTeamForm({ ...teamForm, bio: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', color: '#cbd5e1' }}>
                      <input
                        type="checkbox"
                        checked={teamForm.is_lead}
                        onChange={e => setTeamForm({ ...teamForm, is_lead: e.target.checked })}
                        style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                      />
                      Is Lead Architect (Glow Badge)
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Order:</span>
                      <input
                        type="number"
                        min="0"
                        value={teamForm.display_order}
                        onChange={e => setTeamForm({ ...teamForm, display_order: e.target.value })}
                        style={{ width: '60px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '6px', borderRadius: '8px', color: 'white', textAlign: 'center' }}
                      />
                    </div>
                  </div>

                  {actionStatus.error && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{actionStatus.error}</div>}
                  {actionStatus.success && <div style={{ color: '#10b981', fontSize: '0.85rem' }}>{actionStatus.success}</div>}

                  <button type="submit" disabled={actionStatus.loading} className="btn-primary" style={{ padding: '12px', marginTop: '0.5rem' }}>
                    {actionStatus.loading ? 'Adding...' : 'Save Member to Core Team'}
                  </button>
                </form>
              </div>

              {/* List: Existing Team Members */}
              <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="#6366f1" /> Active Team Members ({teamMembers.length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {teamMembers.map(member => (
                    <div
                      key={member.id}
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '14px',
                        background: 'rgba(255,255,255,0.03)',
                        border: member.is_lead ? '1px solid rgba(99,102,241,0.35)' : '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img
                          src={member.avatar_url || `https://github.com/${member.github_username}.png`}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>{member.name}</span>
                            {member.is_lead && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontWeight: 800 }}>LEAD</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#a5b4fc' }}>@{member.github_username} • {member.role}</div>
                          {member.tech_stack && (
                            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                              {member.tech_stack.map(tag => (
                                <span key={tag} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteTeamMember(member.id, member.name)}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── UPCOMING RELEASES (COMING SOON) MANAGEMENT TAB ── */}
          {activeTab === TAB.UPCOMING && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.3fr)', gap: '2rem' }}>
              
              {/* Form: Create Upcoming Release */}
              <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Rocket size={18} color="#f59e0b" /> Create Release Teaser
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Publish a "Coming Soon" card with a live development progress bar. When ready, the creator can upload the APK to automatically launch it!
                </p>

                <form onSubmit={handleAddUpcoming} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Teaser Type Toggle */}
                  <div style={{ display: 'flex', gap: '0.6rem', padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                    <button
                      type="button"
                      onClick={() => setUpcomingForm(prev => ({ ...prev, is_update: false, existing_app_id: null, app_name: '', icon_url: '', estimated_release: 'Coming Soon' }))}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: !upcomingForm.is_update ? 'var(--accent-gradient)' : 'transparent',
                        color: !upcomingForm.is_update ? 'white' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Rocket size={14} /> New App Launch
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpcomingForm(prev => ({ ...prev, is_update: true, estimated_release: 'Update Soon' }))}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: upcomingForm.is_update ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
                        color: upcomingForm.is_update ? 'white' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <RefreshCw size={14} /> App Update Teaser
                    </button>
                  </div>

                  {/* App Selection or App Name Input */}
                  {upcomingForm.is_update ? (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Select Existing App to Update
                      </label>
                      <select
                        value={upcomingForm.existing_app_id || ''}
                        onChange={(e) => {
                          const selectedApp = apps.find(a => a.id === e.target.value);
                          if (selectedApp) {
                            setUpcomingForm(prev => ({
                              ...prev,
                              existing_app_id: selectedApp.id,
                              app_name: selectedApp.name,
                              icon_url: selectedApp.icon_url,
                              version: `v${(parseFloat(selectedApp.version?.replace('v', '') || '1.0') + 1.0).toFixed(1)}.0`
                            }));
                            setUpcomingIconPreview(selectedApp.icon_url || null);
                            setUpcomingIconFile(null);
                          }
                        }}
                        required
                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                      >
                        <option value="">-- Choose Existing App --</option>
                        {apps.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} (Current: {a.version})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Application Name</label>
                      <input
                        type="text"
                        placeholder="e.g. MSM Cloud Backup"
                        value={upcomingForm.app_name}
                        onChange={e => setUpcomingForm({ ...upcomingForm, app_name: e.target.value })}
                        required
                        style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target Version</label>
                      <input
                        type="text"
                        placeholder="v1.0.0-beta"
                        value={upcomingForm.version}
                        onChange={e => setUpcomingForm({ ...upcomingForm, version: e.target.value })}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated Date</label>
                      <input
                        type="text"
                        placeholder="e.g. Q1 2026"
                        value={upcomingForm.estimated_release}
                        onChange={e => setUpcomingForm({ ...upcomingForm, estimated_release: e.target.value })}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Development Progress: {upcomingForm.progress}%
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="99"
                      value={upcomingForm.progress}
                      onChange={e => setUpcomingForm({ ...upcomingForm, progress: e.target.value })}
                      style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Short Tagline</label>
                    <input
                      type="text"
                      placeholder="e.g. Automated encrypted cloud sync for Android"
                      value={upcomingForm.tagline}
                      onChange={e => setUpcomingForm({ ...upcomingForm, tagline: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Detailed Description</label>
                    <textarea
                      placeholder="Describe the upcoming application features..."
                      rows={3}
                      value={upcomingForm.description}
                      onChange={e => setUpcomingForm({ ...upcomingForm, description: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>

                  {/* App Icon Upload Field */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      App Icon (PNG, JPG, WebP)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div 
                        style={{ 
                          width: '48px', 
                          height: '48px', 
                          borderRadius: '12px', 
                          background: 'rgba(255,255,255,0.04)', 
                          border: '1px dashed var(--glass-border)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          overflow: 'hidden',
                          flexShrink: 0
                        }}
                      >
                        {upcomingIconPreview || upcomingForm.icon_url ? (
                          <img src={upcomingIconPreview || upcomingForm.icon_url} alt="App Icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <ImageIcon size={22} color="var(--text-muted)" />
                        )}
                      </div>
                      <label style={{ 
                        flex: 1, 
                        padding: '9px 12px', 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '10px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                        color: upcomingIconFile ? 'white' : 'var(--text-muted)'
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                          {upcomingIconFile ? upcomingIconFile.name : (upcomingForm.icon_url ? 'App icon loaded' : 'Choose app icon (PNG, JPG)...')}
                        </span>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontWeight: 600, fontSize: '0.75rem', flexShrink: 0 }}>
                          Browse
                        </span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          style={{ display: 'none' }} 
                          onChange={(e) => {
                            const f = e.target.files[0];
                            if (f) {
                              setUpcomingIconFile(f);
                              setUpcomingIconPreview(URL.createObjectURL(f));
                            }
                          }} 
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>GitHub Repository URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://github.com/AttitudeTopHacker/..."
                      value={upcomingForm.github_repo_url}
                      onChange={e => setUpcomingForm({ ...upcomingForm, github_repo_url: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '11px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                    />
                  </div>

                  {actionStatus.error && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{actionStatus.error}</div>}
                  {actionStatus.success && <div style={{ color: '#10b981', fontSize: '0.85rem' }}>{actionStatus.success}</div>}

                  <button type="submit" disabled={actionStatus.loading} className="btn-primary" style={{ padding: '12px', marginTop: '0.5rem' }}>
                    {actionStatus.loading ? 'Creating...' : 'Publish Upcoming Teaser'}
                  </button>
                </form>
              </div>

              {/* List: Existing Upcoming Releases */}
              <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Rocket size={18} color="#f59e0b" /> Active Teasers & Updates ({upcomingList.length})
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All users' submissions</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {loading ? (
                    [1, 2].map(n => (
                      <div key={n} className="glass skeleton-card" style={{ padding: '1.2rem 1.25rem', borderRadius: '14px', minHeight: '80px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="skeleton-shimmer" style={{ width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div className="skeleton-shimmer" style={{ height: '16px', width: '40%', borderRadius: '4px' }} />
                          <div className="skeleton-shimmer" style={{ height: '12px', width: '25%', borderRadius: '4px' }} />
                        </div>
                      </div>
                    ))
                  ) : upcomingList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                      No active teasers or upcoming releases found.
                    </div>
                  ) : (
                    upcomingList.map(item => {
                      const linkedApp = item.existing_app_id ? apps.find(a => a.id === item.existing_app_id) : null;
                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '1.2rem 1.25rem',
                            borderRadius: '14px',
                            background: 'rgba(255,255,255,0.03)',
                            border: item.is_published 
                              ? '1px solid rgba(16, 185, 129, 0.35)' 
                              : item.is_update 
                                ? '1px solid rgba(245, 158, 11, 0.3)' 
                                : '1px solid var(--glass-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                {item.icon_url ? (
                                  <img src={item.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : item.is_update ? (
                                  <RefreshCw size={18} color="#f59e0b" />
                                ) : (
                                  <Rocket size={18} color="#f59e0b" />
                                )}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                  <span style={{ fontWeight: 700, color: 'white', fontSize: '1.05rem' }}>{item.app_name}</span>
                                  <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 600 }}>{item.version}</span>
                                {item.is_update ? (
                                  <span style={{ fontSize: '0.66rem', padding: '3px 9px', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                    <RefreshCw size={11} /> APP UPDATE
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.66rem', padding: '3px 9px', borderRadius: '20px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.35)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                    <Rocket size={11} /> NEW LAUNCH
                                  </span>
                                )}
                                {item.github_repo_url ? (
                                  <span style={{ fontSize: '0.64rem', padding: '3px 8px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.25)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                    <GitBranch size={10} /> GitHub CI/CD
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.64rem', padding: '3px 8px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                    <Upload size={10} /> Manual Upload
                                  </span>
                                )}
                                {item.is_published && (
                                  <span style={{ fontSize: '0.64rem', padding: '3px 8px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                    LIVE ON CSTORE
                                  </span>
                                )}
                              </div>
                              {item.is_update && linkedApp && (
                                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginBottom: '0.2rem' }}>
                                  Target App: <strong>{linkedApp.name}</strong> (v{linkedApp.version} ➔ {item.version})
                                </div>
                              )}
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.tagline || item.description}</div>
                            </div>
                          </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {!item.is_published && (
                                <button
                                  onClick={() => setPublishModal({ isOpen: true, item, file: null, loading: false, error: '', progress: 0 })}
                                  style={{
                                    background: item.is_update ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'var(--accent-gradient)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                  }}
                                >
                                  <Upload size={12} /> Launch / Upload APK
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteUpcoming(item.id, item.app_name)}
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                title="Delete Teaser"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                              <span>Pipeline Status</span>
                              <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{item.progress}%</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${item.progress}%`, background: item.is_update ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'var(--accent-gradient)', borderRadius: '3px' }} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                            <span>Target: <strong style={{ color: '#e2e8f0' }}>{item.estimated_release}</strong></span>
                            <span>Submitted by: <strong style={{ color: '#a5b4fc' }}>{item.creator_email || 'Unknown User'}</strong></span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ── USERS TAB ── */}
          {activeTab === TAB.USERS && (
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '18px', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Registered Users ({users.length})</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '10px 14px' }}>Name</th>
                    <th style={{ padding: '10px 14px' }}>Email</th>
                    <th style={{ padding: '10px 14px' }}>Role</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'white' }}>{u.name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: u.role === 'admin' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', color: u.role === 'admin' ? '#a5b4fc' : 'white', fontWeight: 600 }}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: u.status === 'suspended' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: u.status === 'suspended' ? '#f87171' : '#34d399', fontWeight: 600 }}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleStatusToggle(u.id, u.status)}
                            style={{ background: u.status === 'suspended' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${u.status === 'suspended' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: u.status === 'suspended' ? '#10b981' : '#ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── UPLOAD APP TAB ── */}
          {activeTab === TAB.UPLOAD && (
            <div className="glass" style={{ maxWidth: '650px', margin: '0 auto', padding: '2.5rem', borderRadius: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--primary)' }}>
                  <Upload size={32} />
                </div>
                <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Publish Application</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Upload Android APK directly into CStore Supabase Storage</p>
              </div>

              <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>App Name</label>
                  <input type="text" name="name" required placeholder="e.g. MsmKhata" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Version</label>
                    <input type="text" name="version" required placeholder="e.g. 1.0.0" value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Size (Auto)</label>
                    <input type="text" name="size" placeholder="Auto-calculated" value={formData.size} readOnly style={{ opacity: 0.7 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Description</label>
                  <textarea name="description" rows="3" placeholder="Describe key features..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>

                {/* APK File */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>APK File</label>
                  <div 
                    style={{ 
                      position: 'relative',
                      background: 'rgba(255,255,255,0.02)', 
                      border: '2px dashed var(--glass-border)', 
                      borderRadius: '16px', 
                      padding: '2rem', 
                      textAlign: 'center', 
                      cursor: 'pointer',
                    }}
                  >
                    <input type="file" name="apk" accept=".apk" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                    <File size={32} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem' }} />
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem', color: 'white' }}>{files.apk ? files.apk.name : 'Choose APK file'}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{files.apk ? `Size: ${formData.size}` : 'Up to 500MB chunked'}</p>
                  </div>
                </div>

                {/* Icon File */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Icon (Optional)</label>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed var(--glass-border)', borderRadius: '12px', padding: '1rem', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                    <input type="file" name="icon" accept="image/*" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                    <ImageIcon size={20} color="var(--text-muted)" style={{ marginBottom: '0.25rem' }} />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{files.icon ? files.icon.name : 'Click to select icon image'}</p>
                  </div>
                </div>

                {actionStatus.error && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}>{actionStatus.error}</div>}
                {actionStatus.success && <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}>{actionStatus.success}</div>}

                <button type="submit" disabled={actionStatus.loading} className="btn-primary" style={{ padding: '14px', fontSize: '1rem' }}>
                  {actionStatus.loading ? 'Publishing APK...' : 'Publish Application'}
                </button>
              </form>
            </div>
          )}

        </>
      )}

      {/* Launch / Publish Upcoming Release Modal */}
      {publishModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass" style={{ maxWidth: '480px', width: '100%', padding: '2rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <Rocket size={22} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'white' }}>
                Launch {publishModal.item?.app_name}
              </h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Upload the production APK build to launch this application live on CStore.
            </p>

            <form onSubmit={handlePublishUpcoming} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                <div style={{ color: 'white', fontWeight: 600 }}>{publishModal.item?.app_name}</div>
                <div style={{ color: '#a5b4fc', fontSize: '0.78rem' }}>Target Version: {publishModal.item?.version}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                  Creator: {publishModal.item?.creator_email || 'Unknown User'}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Production APK File
                </label>
                <div
                  style={{
                    position: 'relative',
                    background: 'rgba(255,255,255,0.02)',
                    border: '2px dashed var(--glass-border)',
                    borderRadius: '14px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="file"
                    accept=".apk"
                    required
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) setPublishModal(prev => ({ ...prev, file }));
                    }}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  />
                  <File size={28} style={{ color: 'var(--primary)', margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.9rem', color: 'white', fontWeight: 600 }}>
                    {publishModal.file ? publishModal.file.name : 'Choose APK File'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {publishModal.file ? `${(publishModal.file.size / (1024 * 1024)).toFixed(1)} MB` : 'Up to 500MB chunked'}
                  </div>
                </div>
              </div>

              {publishModal.loading && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Uploading Chunks to Supabase Storage...</span>
                    <span>{publishModal.progress}%</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${publishModal.progress}%`, background: 'var(--accent-gradient)', borderRadius: '3px', transition: 'width 0.2s' }} />
                  </div>
                </div>
              )}

              {publishModal.error && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{publishModal.error}</div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  disabled={publishModal.loading}
                  onClick={() => setPublishModal({ isOpen: false, item: null, file: null, loading: false, error: '', progress: 0 })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '9px 18px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishModal.loading || !publishModal.file}
                  className="btn-primary"
                  style={{ padding: '9px 20px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {publishModal.loading ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : 'Confirm & Launch Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
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

      {/* Update App Modal (Admin Panel: local directory upload only) */}
      <UpdateAppModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        app={selectedAppForUpdate}
        token={token}
        onSuccess={fetchAll}
        allowGitHub={false}
      />
    </div>
  );
};

export default AdminDashboard;
