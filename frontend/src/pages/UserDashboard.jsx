import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  User, Download, Calendar, Mail, LayoutGrid, LogOut, Package, 
  Upload, RefreshCw, Rocket, GitBranch, Terminal, Copy, CheckCircle2, 
  Plus, Sparkles, AlertCircle, File, Loader2, ArrowRight, Image as ImageIcon,
  Info, X, ExternalLink, FileText, Sliders, Edit3, Pencil
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ConfirmModal from '../components/ConfirmModal';
import UpdateAppModal from '../components/UpdateAppModal';
import { parseApkMetadata, getAppCategory, cleanAppDescription, getCategoryBadgeStyle } from '../utils/apkMetadata';

const CATEGORIES = [
  'Tools',
  'Productivity',
  'Social & Communication',
  'Entertainment & Media',
  'Games',
  'Finance & Business',
  'Utilities',
  'Education',
  'Personalization',
  'Other'
];

const UserDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [myUpcoming, setMyUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedAppForUpdate, setSelectedAppForUpdate] = useState(null);

  // Publish Upcoming Release Modal State
  const [publishModal, setPublishModal] = useState({
    isOpen: false,
    item: null,
    tab: 'file', // 'file' | 'github'
    file: null,
    parsedMeta: null,
    isParsing: false,
    githubRepo: '',
    githubPat: localStorage.getItem('cstore_gh_pat') || '',
    showPatInput: false,
    githubRelease: null,
    githubFetching: false,
    githubError: '',
    loading: false,
    error: '',
    progress: 0
  });

  const handlePublishFileSelect = async (file) => {
    if (!file) return;
    setPublishModal(prev => ({ ...prev, file, isParsing: true, parsedMeta: null }));
    try {
      const meta = await parseApkMetadata(file);
      setPublishModal(prev => ({ ...prev, parsedMeta: meta, isParsing: false }));
    } catch (err) {
      console.warn('Publish modal APK parse:', err);
      setPublishModal(prev => ({ ...prev, isParsing: false }));
    }
  };

  const handleFetchGitHubRelease = async (repoInput, patInput) => {
    let cleanRepo = (repoInput || '').trim();
    cleanRepo = cleanRepo.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    if (!cleanRepo || !cleanRepo.includes('/')) {
      setPublishModal(prev => ({ ...prev, githubError: 'Please enter valid repo: owner/repo (e.g. AttitudeTopHacker/cstore)' }));
      return;
    }

    setPublishModal(prev => ({ ...prev, githubFetching: true, githubError: '', githubRelease: null }));
    try {
      const pat = (patInput !== undefined ? patInput : publishModal.githubPat || '').trim();
      if (pat) {
        localStorage.setItem('cstore_gh_pat', pat);
      }

      const headers = { 'Accept': 'application/vnd.github.v3+json' };
      if (pat) {
        headers['Authorization'] = `Bearer ${pat}`;
      }

      const res = await fetch(`https://api.github.com/repos/${cleanRepo}/releases/latest`, { headers });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(pat ? 'Release or repository not found. Verify repo name and token permissions.' : 'Repository not found or Private. Click "Private Repo?" below and enter your GitHub Token.');
        }
        if (res.status === 401) {
          throw new Error('Invalid GitHub Personal Access Token (401 Unauthorized).');
        }
        throw new Error(`GitHub error (status ${res.status}).`);
      }
      const data = await res.json();
      const apkAsset = (data.assets || []).find(a => a.name.toLowerCase().endsWith('.apk'));
      if (!apkAsset) {
        throw new Error(`Release "${data.tag_name}" found, but no .apk asset was uploaded to it.`);
      }

      setPublishModal(prev => ({
        ...prev,
        githubFetching: false,
        githubRelease: {
          tagName: data.tag_name,
          releaseName: data.name || data.tag_name,
          apkName: apkAsset.name,
          apkSize: (apkAsset.size / (1024 * 1024)).toFixed(1) + ' MB',
          downloadUrl: apkAsset.browser_download_url
        }
      }));
    } catch (err) {
      setPublishModal(prev => ({ ...prev, githubFetching: false, githubError: err.message }));
    }
  };

  // Detailed Teaser Modal State
  const [selectedTeaserDetails, setSelectedTeaserDetails] = useState(null);
  const [isClosingTeaser, setIsClosingTeaser] = useState(false);

  const handleCloseTeaser = () => {
    setIsClosingTeaser(true);
    setTimeout(() => {
      setSelectedTeaserDetails(null);
      setIsClosingTeaser(false);
    }, 200);
  };

  // Create Teaser Modal State
  const [isTeaserModalOpen, setIsTeaserModalOpen] = useState(false);
  const [teaserForm, setTeaserForm] = useState({
    app_name: '',
    category: 'Tools',
    tagline: '',
    description: '',
    version: 'v1.0.0-beta',
    estimated_release: 'Coming Soon',
    progress: 50,
    github_repo_url: '',
    icon_url: '',
    is_update: false,
    existing_app_id: null
  });
  const [teaserIconFile, setTeaserIconFile] = useState(null);
  const [teaserIconPreview, setTeaserIconPreview] = useState(null);
  const [teaserLoading, setTeaserLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Edit Pipeline Progress & Teaser Details Modal State
  const [editTeaserModal, setEditTeaserModal] = useState({
    isOpen: false,
    item: null,
    progress: 50,
    version: '',
    estimated_release: 'Coming Soon',
    tagline: '',
    description: '',
    category: 'Tools',
    loading: false,
    error: ''
  });

  const handleOpenEditTeaser = (item) => {
    setEditTeaserModal({
      isOpen: true,
      item,
      progress: item.progress || 50,
      version: item.version || '',
      estimated_release: item.estimated_release || 'Coming Soon',
      tagline: item.tagline || '',
      description: cleanAppDescription(item.description || ''),
      category: getAppCategory(item),
      loading: false,
      error: ''
    });
  };

  const handleUpdateTeaserProgress = async (e) => {
    e.preventDefault();
    if (!editTeaserModal.item) return;

    setEditTeaserModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const cleanDesc = cleanAppDescription(editTeaserModal.description || '').trim();
      const finalDesc = editTeaserModal.category
        ? `[Category: ${editTeaserModal.category}]\n\n${cleanDesc}`.trim()
        : cleanDesc;

      const progressVal = Math.min(100, Math.max(0, parseInt(editTeaserModal.progress, 10) || 0));

      const { error: updateErr } = await supabase
        .from('upcoming_releases')
        .update({
          progress: progressVal,
          version: editTeaserModal.version || 'v1.0.0-beta',
          estimated_release: editTeaserModal.estimated_release || 'Coming Soon',
          target_date: editTeaserModal.estimated_release || 'Coming Soon',
          tagline: editTeaserModal.tagline || '',
          description: finalDesc,
          tags: [editTeaserModal.category || 'Tools'],
          updated_at: new Date().toISOString()
        })
        .eq('id', editTeaserModal.item.id);

      if (updateErr) throw updateErr;

      setEditTeaserModal({ isOpen: false, item: null, progress: 50, version: '', estimated_release: 'Coming Soon', tagline: '', description: '', category: 'Tools', loading: false, error: '' });
      fetchData();
    } catch (err) {
      setEditTeaserModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to update progress' }));
    }
  };

  // Complete Draft Build Modal State
  const [selectedDraftApp, setSelectedDraftApp] = useState(null);
  const [draftForm, setDraftForm] = useState({ name: '', description: '', tagline: '' });
  const [draftIconFile, setDraftIconFile] = useState(null);
  const [draftIconPreview, setDraftIconPreview] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [isClosingDraft, setIsClosingDraft] = useState(false);

  const handleOpenDraftModal = (app) => {
    setSelectedDraftApp(app);
    setDraftForm({
      name: app.name || '',
      description: (app.description && !app.description.includes('Draft build')) ? app.description : '',
      tagline: ''
    });
    setDraftIconFile(null);
    setDraftIconPreview(app.icon_url || null);
    setDraftError('');
  };

  const handleCloseDraftModal = () => {
    setIsClosingDraft(true);
    setTimeout(() => {
      setSelectedDraftApp(null);
      setIsClosingDraft(false);
    }, 200);
  };

  const handlePublishDraft = async (e) => {
    e.preventDefault();
    if (!draftForm.name.trim()) {
      setDraftError('App name is required');
      return;
    }
    if (!draftIconFile && !draftIconPreview) {
      setDraftError('Please choose an App Icon to go live');
      return;
    }
    if (!draftForm.description.trim()) {
      setDraftError('Please write a brief description for your app');
      return;
    }

    setDraftLoading(true);
    setDraftError('');

    try {
      let finalIconUrl = draftIconPreview;
      if (draftIconFile) {
        const iconFileName = `${Date.now()}-${draftIconFile.name.replace(/\s+/g, '_')}`;
        const { error: iconErr } = await supabase.storage.from('cstore-icons').upload(iconFileName, draftIconFile, { upsert: true });
        if (iconErr) {
          await supabase.storage.from('cstore-apps').upload(iconFileName, draftIconFile, { upsert: true });
        }
        const { data: { publicUrl } } = supabase.storage.from('cstore-icons').getPublicUrl(iconFileName);
        finalIconUrl = publicUrl;
      }

      const { error: updateErr } = await supabase
        .from('apps')
        .update({
          name: draftForm.name.trim(),
          description: draftForm.description.trim(),
          icon_url: finalIconUrl,
          is_draft: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDraftApp.id);

      if (updateErr) throw updateErr;

      handleCloseDraftModal();
      fetchData();
    } catch (err) {
      setDraftError(err.message || 'Failed to publish app');
    } finally {
      setDraftLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const currentUserId = user?.id;
      const currentUserEmail = user?.email;

      const [appsRes, downloadsRes, upcomingRes] = await Promise.all([
        supabase.from('apps').select('*').order('created_at', { ascending: false }),
        currentUserId
          ? supabase.from('downloads').select('id, downloaded_at, apps (id, name, version, icon_url)').eq('user_id', currentUserId).order('downloaded_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('upcoming_releases').select('*').order('created_at', { ascending: false })
      ]);

      const allApps = appsRes.data || [];
      const userDownloads = downloadsRes.data || [];
      const allUpcoming = upcomingRes.data || [];

      setProfile(user);
      setDownloads(userDownloads);

      if (currentUserId || currentUserEmail) {
        setMyApps(allApps.filter(app => 
          (currentUserId && app.user_id === currentUserId) ||
          (currentUserEmail && app.publisher_email && app.publisher_email.toLowerCase() === currentUserEmail.toLowerCase())
        ));
        setMyUpcoming(allUpcoming.filter(item => 
          (currentUserId && item.created_by === currentUserId) ||
          (currentUserEmail && item.creator_email && item.creator_email.toLowerCase() === currentUserEmail.toLowerCase())
        ));
      } else {
        setMyApps([]);
        setMyUpcoming([]);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, user?.id]);

  const handleLogout = () => { logout(); navigate('/'); };
  const confirmLogout = () => setShowLogoutModal(true);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // Handle Publish Upcoming Release
  const handlePublishUpcoming = async (e) => {
    e.preventDefault();
    if (!publishModal.item) return;
    if (publishModal.tab === 'file' && !publishModal.file) return;
    if (publishModal.tab === 'github' && !publishModal.githubRelease) return;

    setPublishModal(prev => ({ ...prev, loading: true, error: '' }));
    const releaseItem = publishModal.item;

    try {
      let apkFile = publishModal.file;

      // In Option B (GitHub Release), auto-stream APK directly from GitHub!
      if (!apkFile && publishModal.tab === 'github' && publishModal.githubRelease) {
        setPublishModal(prev => ({ ...prev, progress: 5 }));
        const release = publishModal.githubRelease;
        let blob = null;

        // Try local dev proxy first
        try {
          const proxyRes = await fetch(`/api/download-github-apk?url=${encodeURIComponent(release.downloadUrl)}`, {
            headers: publishModal.githubPat ? { 'x-github-token': publishModal.githubPat } : {}
          });
          if (proxyRes.ok) {
            blob = await proxyRes.blob();
          }
        } catch (_) {}

        // Fallback: direct fetch
        if (!blob) {
          try {
            const directRes = await fetch(release.downloadUrl);
            if (directRes.ok) {
              blob = await directRes.blob();
            }
          } catch (_) {}
        }

        if (!blob) {
          throw new Error('Unable to stream APK directly from GitHub. Please check network or use Option A.');
        }

        apkFile = new File([blob], release.apkName, { type: 'application/vnd.android.package-archive' });
      }

      if (!apkFile) {
        throw new Error('No APK file available to upload.');
      }
      const CHUNK_SIZE = 9 * 1024 * 1024; // 9MB chunks
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

      let targetAppId = null;

      // If releaseItem has no icon, but parsed APK provided one, upload it!
      let liveIconUrl = releaseItem.icon_url || null;
      if (!liveIconUrl && publishModal.parsedMeta?.iconFile) {
        try {
          const iconFileName = `icons/${Date.now()}_${publishModal.parsedMeta.iconFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const { error: iconErr } = await supabase.storage.from('cstore-icons').upload(iconFileName, publishModal.parsedMeta.iconFile, { upsert: true });
          if (!iconErr) {
            const { data: { publicUrl } } = supabase.storage.from('cstore-icons').getPublicUrl(iconFileName);
            liveIconUrl = publicUrl;
          }
        } catch (_) {}
      }

      const effectiveVersion = (releaseItem.version && releaseItem.version !== 'Coming Soon')
        ? releaseItem.version
        : (publishModal.parsedMeta?.version || 'v1.0.0');

      if (releaseItem.is_update && releaseItem.existing_app_id) {
        // App Update Flow: Archive old version & update existing app record
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
              changelog: `Updated to ${effectiveVersion}`
            }]);
          } catch (_) {}
        }

        const { error: appUpdateErr } = await supabase
          .from('apps')
          .update({
            version: effectiveVersion,
            description: releaseItem.description || currentApp?.description,
            file_url: finalFileUrl,
            size: sizeMB,
            is_chunked: isChunked,
            chunk_count: totalChunks,
            updated_at: new Date().toISOString()
          })
          .eq('id', releaseItem.existing_app_id);

        if (appUpdateErr) throw appUpdateErr;
        targetAppId = releaseItem.existing_app_id;
      } else {
        // Brand New App Flow: Insert into live apps
        const { data: newApp, error: appInsertErr } = await supabase
          .from('apps')
          .insert([{
            name: releaseItem.app_name,
            version: effectiveVersion,
            description: releaseItem.description,
            file_url: finalFileUrl,
            icon_url: liveIconUrl,
            size: sizeMB,
            is_chunked: isChunked,
            chunk_count: totalChunks,
            download_count: 0,
            user_id: user?.id || null
          }])
          .select()
          .single();

        if (appInsertErr) throw appInsertErr;
        targetAppId = newApp.id;
      }

      // Mark upcoming release as published (removes from active Coming Soon deck!)
      await supabase
        .from('upcoming_releases')
        .update({
          is_published: true,
          published_app_id: targetAppId,
          updated_at: new Date().toISOString()
        })
        .eq('id', releaseItem.id);

      setPublishModal({ isOpen: false, item: null, file: null, loading: false, error: '', progress: 0 });
      fetchData();
    } catch (err) {
      console.error('Publish error:', err);
      setPublishModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to publish release.' }));
    }
  };

  // Helper to reliably detect if an upcoming release is an app update
  const isAppUpdate = (item) => {
    if (!item) return false;
    if (item.is_update === true || item.is_update === 'true' || item.is_update === 1) return true;
    if (item.existing_app_id) return true;
    const cleanItemName = item.app_name?.trim().toLowerCase();
    if (cleanItemName && myApps.some(a => a.name?.trim().toLowerCase() === cleanItemName)) return true;
    return false;
  };

  // Helper to detect if an app was published via GitHub Actions vs Manual
  const isGitHubSource = (app) => {
    if (!app) return false;
    if (app.upload_source === 'github') return true;
    if (app.upload_source === 'manual') return false;
    if (app.description && (app.description.includes('GitHub Actions') || app.description.includes('CI/CD'))) return true;
    if (app.publisher_name && app.publisher_name.toLowerCase().includes('github')) return true;
    return false;
  };

  // Create Teaser
  const handleCreateTeaser = async (e) => {
    e.preventDefault();
    if (!teaserForm.app_name) return;
    setTeaserLoading(true);
    try {
      let iconUrl = teaserForm.icon_url || null;

      if (teaserIconFile) {
        const cleanName = teaserIconFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const iconFileName = `icons/${Date.now()}_${cleanName}`;
        const { error: iconError } = await supabase.storage.from('cstore-icons').upload(iconFileName, teaserIconFile, { upsert: true });
        if (!iconError) {
          const { data: { publicUrl } } = supabase.storage.from('cstore-icons').getPublicUrl(iconFileName);
          iconUrl = publicUrl;
        } else {
          const { error: appErr } = await supabase.storage.from('cstore-apps').upload(iconFileName, teaserIconFile, { upsert: true });
          if (!appErr) {
            const { data: { publicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(iconFileName);
            iconUrl = publicUrl;
          }
        }
      }

      let finalDesc = teaserForm.description?.trim() || '';
      if (teaserForm.category && !finalDesc.includes('[Category:')) {
        finalDesc = `[Category: ${teaserForm.category}]\n\n${finalDesc}`.trim();
      }

      const { error } = await supabase.from('upcoming_releases').insert([{
        app_name: teaserForm.app_name,
        tagline: teaserForm.tagline || '',
        description: finalDesc,
        tags: [teaserForm.category || 'Tools'],
        version: teaserForm.version || 'v1.0.0-beta',
        estimated_release: teaserForm.estimated_release || 'Coming Soon',
        target_date: teaserForm.estimated_release || 'Coming Soon',
        progress: parseInt(teaserForm.progress, 10) || 50,
        github_repo_url: teaserForm.github_repo_url || null,
        icon_url: iconUrl,
        is_update: !!teaserForm.is_update,
        existing_app_id: teaserForm.existing_app_id || null,
        created_by: user?.id || null,
        creator_email: user?.email || null,
        creator_name: user?.name || null,
        is_published: false
      }]);

      if (error) throw error;
      setIsTeaserModalOpen(false);
      setTeaserForm({ app_name: '', category: 'Tools', tagline: '', description: '', version: 'v1.0.0-beta', estimated_release: 'Coming Soon', progress: 50, github_repo_url: '', icon_url: '', is_update: false, existing_app_id: null });
      setTeaserIconFile(null);
      setTeaserIconPreview(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setTeaserLoading(false);
    }
  };

  return (
    <div style={{ padding: '2.5rem 0' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.45rem, 5vw, 2.2rem)', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            Developer & User Console
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.88rem' }}>Welcome back, {user?.name}!</p>
        </div>
        <button onClick={confirmLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '9px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      {/* Profile Card */}
      <div className="glass" style={{ padding: 'clamp(1.2rem, 3.5vw, 2rem)', marginBottom: '2.5rem', display: 'flex', gap: 'clamp(1rem, 3vw, 2rem)', alignItems: 'center', flexWrap: 'wrap', borderRadius: '20px' }}>
        <div style={{ width: 'clamp(58px, 14vw, 74px)', height: 'clamp(58px, 14vw, 74px)', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', fontWeight: 800, color: 'white' }}>{(user?.name || user?.email || 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <h2 style={{ fontSize: 'clamp(1.2rem, 3.5vw, 1.4rem)', marginBottom: '0.4rem', color: 'white' }}>{profile?.name}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem' }}>
              <Mail size={14} /> {profile?.email}
            </span>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem' }}>
              <Calendar size={14} /> Member since {formatDate(profile?.created_at || new Date())}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', width: 'auto', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '8px 14px', textAlign: 'center', flex: 1, minWidth: '85px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#6366f1' }}>{myApps.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Published Apps</div>
          </div>
          <div style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '12px', padding: '8px 14px', textAlign: 'center', flex: 1, minWidth: '85px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#a855f7' }}>{myUpcoming.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Teasers</div>
          </div>
        </div>
      </div>

      {/* ── 1. MY UPCOMING RELEASES (COMING SOON) ─────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.85rem' }}>
        <h3 style={{ fontSize: 'clamp(1.1rem, 3.5vw, 1.25rem)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
          <Rocket size={18} color="#f59e0b" /> My Upcoming Releases ({myUpcoming.length})
        </h3>
        <button
          onClick={() => setIsTeaserModalOpen(true)}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={15} /> Create Coming Soon Teaser
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {[1, 2].map(n => (
            <div key={n} className="glass skeleton-card app-card" style={{ padding: '1.25rem 1.15rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '170px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div className="skeleton-shimmer" style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div className="skeleton-shimmer" style={{ height: '16px', width: '60%', borderRadius: '4px' }} />
                  <div className="skeleton-shimmer" style={{ height: '12px', width: '40%', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div className="skeleton-shimmer" style={{ height: '12px', width: '90%', borderRadius: '3px' }} />
                <div className="skeleton-shimmer" style={{ height: '8px', width: '100%', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : myUpcoming.length === 0 ? (
        <div className="glass app-card" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: '18px', marginBottom: '2.5rem' }}>
          <Rocket size={36} style={{ color: '#f59e0b', opacity: 0.5, marginBottom: '0.75rem' }} />
          <h4 style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: 'white' }}>No Active Teasers</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '450px', margin: '0 auto 1.25rem' }}>
            Publish a "Coming Soon" teaser on the Concept 2 Explore Deck. When your build is ready, launch it with a single click.
          </p>
          <button onClick={() => setIsTeaserModalOpen(true)} className="btn-primary" style={{ padding: '9px 18px', fontSize: '0.85rem' }}>
            Create First Teaser
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {myUpcoming.map(item => (
            <div
              key={item.id}
              className="glass card-loaded-fade app-card"
              style={{
                padding: 'clamp(1.15rem, 3.5vw, 1.4rem)',
                borderRadius: '18px',
                border: item.is_published 
                  ? '1px solid rgba(16, 185, 129, 0.35)' 
                  : isAppUpdate(item) 
                    ? '1px solid rgba(245, 158, 11, 0.3)' 
                    : '1px solid rgba(168, 85, 247, 0.3)',
                background: isAppUpdate(item)
                  ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.04) 0%, rgba(15, 23, 42, 0.7) 100%)'
                  : 'linear-gradient(145deg, rgba(168, 85, 247, 0.04) 0%, rgba(15, 23, 42, 0.7) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                position: 'relative'
              }}
            >
              <div>
                {/* 1. Header Badges Row: Clean, uncluttered, no title crowding */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {/* Launch / Update Type Pill */}
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      padding: '3px 9px',
                      borderRadius: '20px',
                      background: isAppUpdate(item) ? 'rgba(245, 158, 11, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      color: isAppUpdate(item) ? '#fbbf24' : '#c084fc',
                      border: isAppUpdate(item) ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(168, 85, 247, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      {isAppUpdate(item) ? <RefreshCw size={10} /> : <Rocket size={10} />}
                      {isAppUpdate(item) ? 'APP UPDATE' : 'NEW LAUNCH'}
                    </span>

                    {/* Category Pill */}
                    {(() => {
                      const cat = getAppCategory(item);
                      const style = getCategoryBadgeStyle(cat);
                      return (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          padding: '3px 9px',
                          borderRadius: '20px',
                          background: style.bg,
                          color: style.color,
                          border: `1px solid ${style.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          whiteSpace: 'nowrap'
                        }}>
                          {cat}
                        </span>
                      );
                    })()}

                    {/* Source Pill: GitHub CI/CD vs Manual Upload */}
                    <span style={{
                      fontSize: '0.63rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '20px',
                      background: item.github_repo_url ? 'rgba(99, 102, 241, 0.12)' : 'rgba(56, 189, 248, 0.1)',
                      color: item.github_repo_url ? '#a5b4fc' : '#38bdf8',
                      border: item.github_repo_url ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(56, 189, 248, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.github_repo_url ? <GitBranch size={9} /> : <Upload size={9} />}
                      {item.github_repo_url ? 'GitHub CI/CD' : 'Manual Upload'}
                    </span>
                  </div>

                  {/* Status Indicator & Quick Edit */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditTeaser(item)}
                      style={{
                        fontSize: '0.64rem',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
                      title="Edit progress & milestone"
                    >
                      <Edit3 size={10} /> Edit
                    </button>
                    {item.is_published ? (
                      <span style={{
                        fontSize: '0.64rem',
                        padding: '3px 9px',
                        borderRadius: '20px',
                        background: 'rgba(16, 185, 129, 0.18)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        <CheckCircle2 size={10} /> LIVE
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.64rem',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
                        In Pipeline
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. App Name & Icon: Full Horizontal Width without wrapping */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.9rem' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: isAppUpdate(item) ? 'rgba(245, 158, 11, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                    border: isAppUpdate(item) ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}>
                    {item.icon_url ? (
                      <img src={item.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : isAppUpdate(item) ? (
                      <RefreshCw size={20} color="#fbbf24" />
                    ) : (
                      <Rocket size={22} color="#c084fc" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '1.18rem',
                        color: 'white',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: '-0.01em'
                      }}
                      title={item.app_name}
                    >
                      {item.app_name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                      <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{item.version}</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {isAppUpdate(item) ? 'Update Soon' : (item.estimated_release || 'Coming Soon')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Description / Tagline row with More button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', margin: '0 0 1.1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {item.tagline || item.description || 'Upcoming Android release.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedTeaserDetails(item)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      color: '#cbd5e1',
                      padding: '4px 9px',
                      borderRadius: '7px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.color = '#cbd5e1';
                    }}
                    title="Read full detailed description"
                  >
                    <Info size={12} /> More
                  </button>
                </div>

                {/* 4. Progress bar with interactive Update action */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Pipeline Progress</span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditTeaser(item)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: '#c084fc',
                          padding: '1px 7px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.2s'
                        }}
                        title="Click to update pipeline progress"
                      >
                        <Sliders size={10} /> Update
                      </button>
                    </div>
                    <span
                      onClick={() => handleOpenEditTeaser(item)}
                      style={{ color: '#a5b4fc', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      title="Click to edit progress"
                    >
                      {item.progress}% Completed
                    </span>
                  </div>
                  <div
                    onClick={() => handleOpenEditTeaser(item)}
                    style={{ height: '7px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', cursor: 'pointer' }}
                    title="Click to update progress"
                  >
                    <div style={{
                      height: '100%',
                      width: `${item.progress}%`,
                      background: isAppUpdate(item)
                        ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                        : 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              </div>

              {!item.is_published && (
                <button
                  onClick={() => setPublishModal({
                    isOpen: true,
                    item,
                    tab: 'file',
                    file: null,
                    githubRepo: item.github_repo_url || '',
                    githubPat: localStorage.getItem('cstore_gh_pat') || '',
                    showPatInput: false,
                    githubRelease: null,
                    githubFetching: false,
                    githubError: '',
                    loading: false,
                    error: '',
                    progress: 0
                  })}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                    marginTop: '0.5rem'
                  }}
                >
                  <Upload size={14} /> Link / Import APK & Go Live
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 2. CARD-FIRST 2-STEP APP PUBLISHING WORKFLOW ────────────────── */}
      <div className="glass" style={{ padding: '2rem', borderRadius: '20px', marginBottom: '2.5rem', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Rocket size={22} color="#34d399" />
            <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'white' }}>Card-First Publishing Workflow</h3>
          </div>
          <span style={{ fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 800 }}>
            Zero Duplicates • 100% Visual Control
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Publish and update your Android applications directly from your CStore dashboard in 2 clean steps:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', padding: '1.1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: '#fbbf24', fontWeight: 800, fontSize: '0.95rem' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>1</span>
              Step 1: Create Card
            </div>
            <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Click <strong>"+ Create Coming Soon Teaser"</strong> above. Set your App Name, Category, High-Res Icon, and detailed description.
            </p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', padding: '1.1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: '#34d399', fontWeight: 800, fontSize: '0.95rem' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>2</span>
              Step 2: Link APK & Go Live
            </div>
            <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Click <strong>"Link / Import APK & Go Live"</strong> on your card. Drag & drop your APK file or link from GitHub Releases — Supabase chunk uploads it with live progress!
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsTeaserModalOpen(true)}
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={15} /> Create App Card Now
          </button>
          <button
            onClick={() => navigate('/upload')}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--glass-border)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Upload size={14} /> Direct Upload Page
          </button>
        </div>
      </div>

      {/* ── 2.5. CI/CD DRAFT BUILDS (NEEDS DETAILS) ────────────────────── */}
      {(() => {
        const draftApps = myApps.filter(app => app.is_draft || (!app.icon_url && app.upload_source === 'github'));
        if (draftApps.length === 0) return null;

        return (
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="#fbbf24" /> CI/CD Draft Builds ({draftApps.length})
              </h3>
              <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={11} /> Action Required: Add Icon & Description
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {draftApps.map(app => (
                <div
                  key={app.id}
                  className="glass card-loaded-fade"
                  style={{
                    padding: '1.25rem 1.75rem',
                    borderRadius: '16px',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.8) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.5rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '240px', flex: 1 }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.12)', border: '1px dashed rgba(245, 158, 11, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0 }}>
                      <ImageIcon size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: 'white', fontSize: '1.1rem' }}>{app.name}</span>
                        {(() => {
                          const cat = getAppCategory(app);
                          const style = getCategoryBadgeStyle(cat);
                          return (
                            <span style={{
                              fontSize: '0.66rem',
                              padding: '1px 7px',
                              borderRadius: '5px',
                              background: style.bg,
                              border: `1px solid ${style.border}`,
                              color: style.color,
                              fontWeight: 700
                            }}>
                              {cat}
                            </span>
                          );
                        })()}
                        <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600 }}>{app.version}</span>
                        <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <GitBranch size={9} /> GitHub Actions
                        </span>
                      </div>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                        APK uploaded safely ({app.size}). Missing App Icon & Description to go live on store.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenDraftModal(app)}
                    className="btn-primary"
                    style={{
                      padding: '9px 18px',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                      flexShrink: 0
                    }}
                  >
                    <Sparkles size={14} /> Complete Details & Go Live
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── 3. MY UPLOADED APPS ─────────────────────────────────────────── */}
      {(() => {
        const publishedApps = myApps.filter(app => !app.is_draft && !( !app.icon_url && app.upload_source === 'github' ));

        return (
          <>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
              <Package size={18} color="#a855f7" /> My Uploaded Apps ({publishedApps.length})
            </h3>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                {[1, 2, 3].map(n => (
                  <div key={n} className="glass skeleton-card" style={{ padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1.5rem', borderRadius: '16px', minHeight: '76px' }}>
                    <div className="skeleton-shimmer" style={{ width: '46px', height: '46px', borderRadius: '12px', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <div className="skeleton-shimmer" style={{ height: '16px', width: '35%', borderRadius: '4px' }} />
                      <div className="skeleton-shimmer" style={{ height: '12px', width: '20%', borderRadius: '4px' }} />
                    </div>
                    <div className="skeleton-shimmer" style={{ width: '100px', height: '32px', borderRadius: '8px' }} />
                  </div>
                ))}
              </div>
            ) : publishedApps.length === 0 ? (
              <div className="glass" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: '18px', marginBottom: '2.5rem' }}>
                <Package size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>You haven't uploaded any applications yet.</p>
                <button onClick={() => navigate('/upload')} className="btn-primary" style={{ padding: '9px 18px', fontSize: '0.85rem' }}>
                  <Upload size={15} style={{ marginRight: '6px' }} /> Upload Your First App
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                {publishedApps.map((app) => (
                  <div key={app.id} className="glass card-loaded-fade" style={{ padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', borderRadius: '16px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {app.icon_url ? (
                        <img src={app.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : <LayoutGrid size={20} color="#6366f1" />}
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'white' }}>{app.name}</span>
                        {(() => {
                          const cat = getAppCategory(app);
                          const style = getCategoryBadgeStyle(cat);
                          return (
                            <span style={{
                              fontSize: '0.66rem',
                              padding: '1px 7px',
                              borderRadius: '5px',
                              background: style.bg,
                              border: `1px solid ${style.border}`,
                              color: style.color,
                              fontWeight: 700
                            }}>
                              {cat}
                            </span>
                          );
                        })()}
                        {app.updated_by_admin && (
                          <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '5px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                            ⚡ Admin by Update
                          </span>
                        )}
                        {/* Source Badge: GitHub CI/CD vs Manual */}
                        {isGitHubSource(app) ? (
                          <span 
                            style={{ 
                              fontSize: '0.68rem', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              background: 'rgba(99, 102, 241, 0.15)', 
                              color: '#a5b4fc', 
                              border: '1px solid rgba(99, 102, 241, 0.3)', 
                              fontWeight: 700, 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.3rem' 
                            }}
                            title="Deployed automatically via GitHub Actions CI/CD"
                          >
                            <GitBranch size={11} /> GitHub CI/CD
                          </span>
                        ) : (
                          <span 
                            style={{ 
                              fontSize: '0.68rem', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              background: 'rgba(56, 189, 248, 0.12)', 
                              color: '#38bdf8', 
                              border: '1px solid rgba(56, 189, 248, 0.25)', 
                              fontWeight: 700, 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.3rem' 
                            }}
                            title="Uploaded manually through Web Dashboard"
                          >
                            <Upload size={11} /> Manual Upload
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {app.version} · {app.size}
                        {app.last_updated_by && <span style={{ color: '#a5b4fc', marginLeft: '6px' }}>({app.last_updated_by})</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#10b981', fontSize: '1.15rem' }}>{app.download_count}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Downloads</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDate(app.created_at)}
                    </div>
                    <button 
                      onClick={() => { setSelectedAppForUpdate(app); setIsUpdateModalOpen(true); }}
                      style={{ 
                        background: 'rgba(99,102,241,0.1)', 
                        border: '1px solid rgba(99,102,241,0.25)', 
                        color: '#a5b4fc', 
                        padding: '7px 14px', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.4rem', 
                        fontFamily: 'inherit', 
                        fontSize: '0.82rem',
                        fontWeight: 600
                      }}
                    >
                      <RefreshCw size={13} /> Update Build
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* ── 4. DOWNLOAD HISTORY ─────────────────────────────────────────── */}
      <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
        <Download size={18} color="#6366f1" /> Download History ({downloads.length})
      </h3>

      {downloads.length === 0 ? (
        <div className="glass" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: '18px' }}>
          <Package size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>You haven't downloaded anything yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {downloads.map((dl) => (
            <div key={dl.id} className="glass" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', borderRadius: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {dl.apps?.icon_url ? (
                  <img src={dl.apps.icon_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
                ) : <LayoutGrid size={20} color="#6366f1" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'white', fontSize: '0.95rem' }}>{dl.apps?.name || 'Application'}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{dl.apps?.version} · {dl.apps?.size}</div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {formatDate(dl.downloaded_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      
      {/* 1. Publish Upcoming Release Modal */}
      {publishModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div className="glass" style={{ maxWidth: '540px', width: '100%', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(99, 102, 241, 0.4)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Rocket size={24} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'white' }}>Launch {publishModal.item?.app_name}</h3>
              </div>
              <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: 700 }}>
                {publishModal.item?.version}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Link your Android APK below. It will be chunk-uploaded to Supabase Storage and launched 100% live on CStore with real-time progress.
            </p>

            {/* Tab Switcher: Option A vs Option B */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.35)', padding: '5px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                onClick={() => setPublishModal(prev => ({ ...prev, tab: 'file' }))}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: publishModal.tab === 'file' ? 'var(--primary)' : 'transparent',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.2s'
                }}
              >
                <Upload size={14} /> Option A: Local APK File
              </button>
              <button
                type="button"
                onClick={() => setPublishModal(prev => ({ ...prev, tab: 'github' }))}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: publishModal.tab === 'github' ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.2s'
                }}
              >
                <GitBranch size={14} /> Option B: GitHub Release
              </button>
            </div>

            <form onSubmit={handlePublishUpcoming} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Option B: GitHub Release Controls */}
              {publishModal.tab === 'github' && (
                <div style={{ background: 'rgba(99, 102, 241, 0.06)', borderRadius: '14px', padding: '1.1rem', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 600 }}>
                    Enter GitHub Repository (owner/repo)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="e.g. AttitudeTopHacker/cstore"
                      value={publishModal.githubRepo}
                      onChange={(e) => setPublishModal(prev => ({ ...prev, githubRepo: e.target.value }))}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '0.88rem' }}
                    />
                    <button
                      type="button"
                      disabled={publishModal.githubFetching}
                      onClick={() => handleFetchGitHubRelease(publishModal.githubRepo, publishModal.githubPat)}
                      className="btn-primary"
                      style={{ padding: '9px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}
                    >
                      {publishModal.githubFetching ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Fetch Release
                    </button>
                  </div>

                  {/* Private Repo PAT Toggle */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setPublishModal(prev => ({ ...prev, showPatInput: !prev.showPatInput }))}
                      style={{ background: 'none', border: 'none', color: '#a5b4fc', fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                    >
                      🔑 Private Repo? {publishModal.showPatInput ? 'Hide Token' : 'Add GitHub Personal Access Token'}
                    </button>
                    {publishModal.showPatInput && (
                      <div style={{ marginTop: '0.35rem' }}>
                        <input
                          type="password"
                          placeholder="GitHub Token (ghp_... with repo read permission)"
                          value={publishModal.githubPat}
                          onChange={(e) => setPublishModal(prev => ({ ...prev, githubPat: e.target.value }))}
                          style={{ width: '100%', padding: '7px 11px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                          Saved in your browser localStorage. Requires only read access to releases.
                        </span>
                      </div>
                    )}
                  </div>

                  {publishModal.githubError && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.3rem' }}>{publishModal.githubError}</div>
                  )}

                  {publishModal.githubRelease && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '0.9rem', marginTop: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#34d399', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CheckCircle2 size={16} /> Release Detected: {publishModal.githubRelease.tagName} ({publishModal.githubRelease.apkSize})
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            File: <strong>{publishModal.githubRelease.apkName}</strong>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.18)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '3px 9px', borderRadius: '10px', fontWeight: 700 }}>
                          Direct Stream Ready
                        </span>
                      </div>
                      <p style={{ margin: '0.65rem 0 0', fontSize: '0.77rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Click <strong>"Confirm & Launch Live"</strong> below. CStore will stream the release APK directly from GitHub, chunk it into Supabase Storage, and launch to the store!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Option A ONLY: Dropzone */}
              {publishModal.tab === 'file' && (
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>Select Android APK File (.apk)</span>
                    <span style={{ fontSize: '0.74rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={12} /> Auto-detects Version & Icon
                    </span>
                  </label>
                  <div 
                    style={{ 
                      position: 'relative', 
                      border: publishModal.file ? '2px solid rgba(99, 102, 241, 0.4)' : '2px dashed var(--glass-border)', 
                      borderRadius: '14px', 
                      padding: '1.5rem', 
                      textAlign: 'center', 
                      cursor: 'pointer', 
                      background: publishModal.file ? 'rgba(99, 102, 241, 0.04)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = publishModal.file ? 'rgba(99, 102, 241, 0.4)' : 'var(--glass-border)'; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dropped = e.dataTransfer.files[0];
                      if (dropped && dropped.name.endsWith('.apk')) {
                        handlePublishFileSelect(dropped);
                      } else {
                        alert('Please drop a valid .apk file');
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept=".apk"
                      required
                      onChange={(e) => handlePublishFileSelect(e.target.files[0])}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }}
                    />
                    {publishModal.isParsing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: '#a855f7' }}>
                        <Loader2 size={26} className="animate-spin" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reading APK metadata & icon...</span>
                      </div>
                    ) : (
                      <>
                        <File size={30} style={{ color: publishModal.file ? '#a855f7' : 'var(--primary)', margin: '0 auto 0.5rem' }} />
                        <div style={{ fontWeight: 600, color: 'white', fontSize: '0.95rem' }}>
                          {publishModal.file ? publishModal.file.name : 'Choose or Drag APK File'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {publishModal.file ? `${(publishModal.file.size / (1024 * 1024)).toFixed(1)} MB` : 'Up to 500MB chunked'}
                        </div>
                      </>
                    )}
                  </div>

                  {publishModal.parsedMeta && (
                    <div style={{ 
                      marginTop: '0.65rem', 
                      padding: '0.55rem 0.85rem', 
                      background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)', 
                      border: '1px solid rgba(168, 85, 247, 0.3)', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.6rem', 
                      fontSize: '0.78rem',
                      color: '#e2e8f0'
                    }}>
                      <Sparkles size={14} style={{ color: '#c084fc', flexShrink: 0 }} />
                      <div>
                        <strong>APK Auto-Detected:</strong> {publishModal.parsedMeta.name || 'App'} • {publishModal.parsedMeta.version || 'v1.0.0'} • {publishModal.parsedMeta.size}
                        {publishModal.parsedMeta.iconDataUrl ? ' • Icon extracted' : ''}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {publishModal.loading && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>{publishModal.tab === 'github' ? 'Streaming & Uploading to Supabase...' : 'Chunk Uploading to Supabase...'}</span>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>{publishModal.progress}%</span>
                  </div>
                  <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${publishModal.progress}%`, background: 'var(--accent-gradient)', transition: 'width 0.2s ease' }} />
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
                  onClick={() => setPublishModal(prev => ({ ...prev, isOpen: false, item: null, tab: 'file', file: null, githubRelease: null, githubFetching: false, githubError: '', loading: false, error: '', progress: 0 }))}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '9px 18px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishModal.loading || (publishModal.tab === 'file' ? !publishModal.file : !publishModal.githubRelease)}
                  className="btn-primary"
                  style={{ padding: '9px 20px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {publishModal.loading ? <><Loader2 size={16} className="animate-spin" /> {publishModal.tab === 'github' ? 'Streaming & Deploying...' : 'Publishing...'}</> : 'Confirm & Launch Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Teaser Modal */}
      {isTeaserModalOpen && (
        <div className="modal-backdrop-in" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div className="glass modal-card-in" style={{ maxWidth: '520px', width: '100%', padding: '1.75rem', borderRadius: '24px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Rocket size={22} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'white' }}>Create Coming Soon Teaser</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTeaserModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginBottom: '1rem' }}>
              Build hype for your upcoming application on the Concept 2 Explore Deck.
            </p>

            <form onSubmit={handleCreateTeaser} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Teaser Type Toggle */}
              <div style={{ display: 'flex', gap: '0.6rem', padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                <button
                  type="button"
                  onClick={() => setTeaserForm(prev => ({ ...prev, is_update: false, existing_app_id: null, app_name: '', estimated_release: 'Coming Soon' }))}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: !teaserForm.is_update ? 'var(--accent-gradient)' : 'transparent',
                    color: !teaserForm.is_update ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Rocket size={14} /> New App Teaser
                </button>
                <button
                  type="button"
                  onClick={() => setTeaserForm(prev => ({ ...prev, is_update: true, estimated_release: 'Update Soon' }))}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: teaserForm.is_update ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
                    color: teaserForm.is_update ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <RefreshCw size={14} /> Update My App
                </button>
              </div>

              {/* App Selection or App Name Input */}
              {teaserForm.is_update ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Select App to Update
                  </label>
                  <select
                    value={teaserForm.existing_app_id || ''}
                    onChange={(e) => {
                      const selectedApp = myApps.find(a => a.id === e.target.value);
                      if (selectedApp) {
                        setTeaserForm(prev => ({
                          ...prev,
                          existing_app_id: selectedApp.id,
                          app_name: selectedApp.name,
                          icon_url: selectedApp.icon_url,
                          version: `v${(parseFloat(selectedApp.version?.replace('v', '') || '1.0') + 1.0).toFixed(1)}.0`
                        }));
                        setTeaserIconPreview(selectedApp.icon_url || null);
                        setTeaserIconFile(null);
                      }
                    }}
                    required
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                  >
                    <option value="">-- Choose One of Your Apps --</option>
                    {myApps.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Current: {a.version})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>App Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MSM Cloud Backup"
                    value={teaserForm.app_name}
                    onChange={e => setTeaserForm({ ...teaserForm, app_name: e.target.value })}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                  />
                </div>
              )}

              <div className="modal-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target Version</label>
                  <input
                    type="text"
                    placeholder="v1.0.0-beta"
                    value={teaserForm.version}
                    onChange={e => setTeaserForm({ ...teaserForm, version: e.target.value })}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated Date</label>
                  <input
                    type="text"
                    placeholder="Q1 2026"
                    value={teaserForm.estimated_release}
                    onChange={e => setTeaserForm({ ...teaserForm, estimated_release: e.target.value })}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              {/* App Category Selector */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Category *
                </label>
                <select
                  value={teaserForm.category || 'Tools'}
                  onChange={e => setTeaserForm({ ...teaserForm, category: e.target.value })}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '10px', color: 'white', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} style={{ background: '#0f172a', color: 'white' }}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Development Progress: {teaserForm.progress}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={teaserForm.progress}
                  onChange={e => setTeaserForm({ ...teaserForm, progress: e.target.value })}
                  style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Short Tagline</label>
                <input
                  type="text"
                  placeholder="One sentence summary..."
                  value={teaserForm.tagline}
                  onChange={e => setTeaserForm({ ...teaserForm, tagline: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Detailed Description</label>
                <textarea
                  placeholder="Describe your upcoming app features and release highlights..."
                  rows={3}
                  value={teaserForm.description}
                  onChange={e => setTeaserForm({ ...teaserForm, description: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '10px', color: 'white', fontFamily: 'inherit', resize: 'vertical' }}
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
                    {teaserIconPreview || teaserForm.icon_url ? (
                      <img src={teaserIconPreview || teaserForm.icon_url} alt="App Icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                    color: teaserIconFile ? 'white' : 'var(--text-muted)'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                      {teaserIconFile ? teaserIconFile.name : (teaserForm.icon_url ? 'App icon loaded' : 'Choose app icon (PNG, JPG)...')}
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
                          setTeaserIconFile(f);
                          setTeaserIconPreview(URL.createObjectURL(f));
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsTeaserModalOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '9px 18px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teaserLoading}
                  className="btn-primary"
                  style={{ padding: '9px 20px' }}
                >
                  {teaserLoading ? 'Creating...' : 'Create Teaser'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 3. Detailed Coming Soon Teaser Modal ────────────────────────────── */}
      {selectedTeaserDetails && createPortal(
        <div 
          className={isClosingTeaser ? 'modal-backdrop-out' : 'modal-backdrop-in'}
          style={{ 
            position: 'fixed', 
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(2, 6, 23, 0.85)', 
            backdropFilter: 'blur(20px)', 
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 99999, 
            padding: '1.25rem' 
          }}
          onClick={handleCloseTeaser}
        >
          <div 
            className={isClosingTeaser ? 'modal-card-out' : 'modal-card-in'}
            style={{ 
              width: '100%', 
              maxWidth: '540px', 
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '2rem', 
              borderRadius: '24px', 
              border: selectedTeaserDetails.is_update ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
              background: '#0b132b',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(99, 102, 241, 0.2)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header: Icon + Titles + Close Button */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: selectedTeaserDetails.is_update ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                  border: selectedTeaserDetails.is_update ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {selectedTeaserDetails.icon_url ? (
                    <img src={selectedTeaserDetails.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : selectedTeaserDetails.is_update ? '🔄' : '🚀'}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white', margin: 0 }}>
                      {selectedTeaserDetails.app_name}
                    </h3>
                    <span style={{ 
                      fontSize: '0.72rem', 
                      fontWeight: 800, 
                      padding: '3px 8px', 
                      borderRadius: '6px', 
                      background: selectedTeaserDetails.is_update ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                      color: selectedTeaserDetails.is_update ? '#fde68a' : '#c7d2fe',
                      border: selectedTeaserDetails.is_update ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(99, 102, 241, 0.35)',
                      textTransform: 'uppercase'
                    }}>
                      {selectedTeaserDetails.is_update ? 'Version Update' : 'New Release'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#a5b4fc', marginTop: '0.2rem', fontWeight: 600 }}>
                    Target Version: <span style={{ color: 'white' }}>{selectedTeaserDetails.version || 'v1.0.0'}</span> • Estimated: <span style={{ color: 'white' }}>{selectedTeaserDetails.estimated_release || 'Coming Soon'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseTeaser}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Tagline Highlight Banner */}
            {selectedTeaserDetails.tagline && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                color: '#e0e7ff',
                fontSize: '0.9rem',
                fontWeight: 600,
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Sparkles size={16} color="#a5b4fc" style={{ flexShrink: 0 }} />
                <span>{selectedTeaserDetails.tagline}</span>
              </div>
            )}

            {/* Progress Milestone Bar */}
            <div style={{ marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.9rem 1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Development Milestone:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const item = selectedTeaserDetails;
                      handleCloseTeaser();
                      handleOpenEditTeaser(item);
                    }}
                    style={{
                      background: 'rgba(99, 102, 241, 0.18)',
                      border: '1px solid rgba(99, 102, 241, 0.35)',
                      color: '#c084fc',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sliders size={11} /> Edit Progress
                  </button>
                </div>
                <span style={{ fontWeight: 800, color: selectedTeaserDetails.is_update ? '#fbbf24' : '#818cf8' }}>
                  {selectedTeaserDetails.progress || 50}% Completed
                </span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${selectedTeaserDetails.progress || 50}%`,
                    background: selectedTeaserDetails.is_update ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)' : 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
                    borderRadius: '6px'
                  }}
                />
              </div>
            </div>

            {/* Full Detailed Description Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileText size={15} color="#a5b4fc" /> Full Description & Features
              </h4>
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1rem',
                maxHeight: '220px',
                overflowY: 'auto',
                color: '#e2e8f0',
                fontSize: '0.88rem',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap'
              }}>
                {selectedTeaserDetails.description || selectedTeaserDetails.tagline || 'No extended description provided yet. Check back soon!'}
              </div>
            </div>

            {/* Metadata Footer: Creator info + GitHub repo */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              gap: '0.75rem', 
              paddingTop: '1rem', 
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}>
              <div>
                <span>Creator: </span>
                <strong style={{ color: 'white' }}>{selectedTeaserDetails.creator_name || selectedTeaserDetails.creator_email || 'You'}</strong>
              </div>

              {selectedTeaserDetails.github_repo_url && (
                <a 
                  href={selectedTeaserDetails.github_repo_url} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontWeight: 600 }}
                >
                  <ExternalLink size={13} /> View GitHub Source
                </a>
              )}
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={handleCloseTeaser}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Close
              </button>

              {!selectedTeaserDetails.is_published && (
                <button
                  type="button"
                  onClick={() => {
                    const itemToPublish = selectedTeaserDetails;
                    handleCloseTeaser();
                    setTimeout(() => {
                      setPublishModal({ isOpen: true, item: itemToPublish, file: null, loading: false, error: '', progress: 0 });
                    }, 210);
                  }}
                  className="btn-primary"
                  style={{
                    flex: 1.5,
                    padding: '11px',
                    borderRadius: '10px',
                    background: selectedTeaserDetails.is_update ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: selectedTeaserDetails.is_update ? '0 4px 14px rgba(245, 158, 11, 0.35)' : '0 4px 14px rgba(16, 185, 129, 0.35)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Upload size={14} /> {selectedTeaserDetails.is_update ? 'Release Update Live' : 'Upload APK & Launch'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 4. Complete Draft Setup & Go Live Modal */}
      {selectedDraftApp && createPortal(
        <div
          className={`modal-backdrop-out ${!isClosingDraft ? 'active' : ''}`}
          onClick={handleCloseDraftModal}
        >
          <div
            className={`modal-card-out ${!isClosingDraft ? 'active' : ''} glass`}
            style={{
              maxWidth: '520px',
              width: '95%',
              padding: '2rem',
              borderRadius: '20px',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={20} color="#fbbf24" /> Complete Setup & Go Live
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Add an icon and description to publish your GitHub build to CStore.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDraftModal}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePublishDraft} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>App Title</label>
                <input
                  type="text"
                  required
                  value={draftForm.name}
                  onChange={e => setDraftForm({ ...draftForm, name: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>App Icon (Required)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {draftIconPreview ? (
                      <img src={draftIconPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <ImageIcon size={24} color="#94a3b8" />
                    )}
                  </div>
                  <label style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--glass-border)', textAlign: 'center', cursor: 'pointer', fontSize: '0.82rem', color: '#a5b4fc' }}>
                    <span>{draftIconFile ? draftIconFile.name : 'Choose App Icon (PNG, JPG)...'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files[0];
                        if (f) {
                          setDraftIconFile(f);
                          setDraftIconPreview(URL.createObjectURL(f));
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Detailed Description</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your app features, what's new in this build, etc."
                  value={draftForm.description}
                  onChange={e => setDraftForm({ ...draftForm, description: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {draftError && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertCircle size={14} /> {draftError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCloseDraftModal}
                  style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#cbd5e1', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={draftLoading}
                  className="btn-primary"
                  style={{ flex: 2, padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
                >
                  {draftLoading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                  {draftLoading ? 'Publishing...' : 'Publish to Live Store'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── 5. Edit Pipeline Progress & Teaser Modal ──────────────────────── */}
      {editTeaserModal.isOpen && editTeaserModal.item && createPortal(
        <div
          className="modal-backdrop-in"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            overflowY: 'auto'
          }}
          onClick={() => setEditTeaserModal(prev => ({ ...prev, isOpen: false }))}
        >
          <div
            className="glass modal-card-in"
            style={{
              maxWidth: '540px',
              width: '100%',
              padding: '1.75rem',
              borderRadius: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              background: '#0b132b',
              border: editTeaserModal.item.is_update ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(99, 102, 241, 0.25)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(168, 85, 247, 0.4)'
                }}>
                  <Sliders size={20} color="#c084fc" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white', fontWeight: 800 }}>Update Pipeline Progress</h3>
                  <div style={{ fontSize: '0.78rem', color: '#a5b4fc', marginTop: '2px' }}>
                    {editTeaserModal.item.app_name} • {editTeaserModal.item.is_update ? 'App Update' : 'New Launch'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditTeaserModal(prev => ({ ...prev, isOpen: false }))}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '50%' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Update how far development has progressed for this release. Your cards across the Explore deck and dashboard will reflect this in real time.
            </p>

            {editTeaserModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '10px', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{editTeaserModal.error}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTeaserProgress} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* 1. Interactive Progress Slider Section */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Sparkles size={14} color="#f59e0b" /> Development Progress
                  </label>
                  <span style={{
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    color: editTeaserModal.progress >= 90 ? '#34d399' : editTeaserModal.progress >= 50 ? '#c084fc' : '#fbbf24',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '3px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    {editTeaserModal.progress}%
                  </span>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editTeaserModal.progress}
                  onChange={e => setEditTeaserModal(prev => ({ ...prev, progress: parseInt(e.target.value, 10) }))}
                  style={{ width: '100%', accentColor: '#c084fc', cursor: 'pointer', height: '6px' }}
                />

                {/* Animated Visual Progress Bar Preview */}
                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${editTeaserModal.progress}%`,
                    background: editTeaserModal.item.is_update
                      ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                      : 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
                    borderRadius: '4px',
                    transition: 'width 0.25s ease'
                  }} />
                </div>

                {/* Quick Preset Buttons */}
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  {[
                    { label: '25% Start', val: 25 },
                    { label: '50% Core', val: 50 },
                    { label: '75% Alpha', val: 75 },
                    { label: '90% Beta', val: 90 },
                    { label: '100% Ready', val: 100 }
                  ].map(preset => {
                    const isSelected = editTeaserModal.progress === preset.val;
                    return (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setEditTeaserModal(prev => ({ ...prev, progress: preset.val }))}
                        style={{
                          flex: 1,
                          minWidth: '65px',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.08)',
                          background: isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? 'white' : 'var(--text-muted)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Milestone Helper Text */}
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: '8px', borderLeft: '3px solid #a855f7' }}>
                  {editTeaserModal.progress <= 20 && '🚀 Phase 1: Planning, requirements & architecture definition'}
                  {editTeaserModal.progress > 20 && editTeaserModal.progress <= 40 && '🛠️ Phase 2: Core engine, database & API setup in progress'}
                  {editTeaserModal.progress > 40 && editTeaserModal.progress <= 60 && '🎨 Phase 3: UI design, key workflows & user experience built'}
                  {editTeaserModal.progress > 60 && editTeaserModal.progress <= 80 && '🧪 Phase 4: Internal Alpha/Beta testing, fixing bugs & optimizing'}
                  {editTeaserModal.progress > 80 && editTeaserModal.progress < 100 && '✨ Phase 5: Final QA checks, release notes & pre-launch polish'}
                  {editTeaserModal.progress === 100 && '🎉 Phase 6: 100% Complete! Ready to upload APK & launch live'}
                </div>
              </div>

              {/* 2. Version & Estimated Release Date */}
              <div className="modal-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Target Version</label>
                  <input
                    type="text"
                    value={editTeaserModal.version}
                    onChange={e => setEditTeaserModal(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="e.g. v1.1.0-beta"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Estimated Date</label>
                  <input
                    type="text"
                    value={editTeaserModal.estimated_release}
                    onChange={e => setEditTeaserModal(prev => ({ ...prev, estimated_release: e.target.value }))}
                    placeholder="e.g. Next Week / Dec 2026"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* 3. Category & Short Tagline */}
              <div className="modal-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category</label>
                  <select
                    value={editTeaserModal.category}
                    onChange={e => setEditTeaserModal(prev => ({ ...prev, category: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat} style={{ background: '#0f172a', color: 'white' }}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Short Tagline</label>
                  <input
                    type="text"
                    value={editTeaserModal.tagline}
                    onChange={e => setEditTeaserModal(prev => ({ ...prev, tagline: e.target.value }))}
                    placeholder="One sentence summary..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* 4. Detailed Description */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Detailed Description (Optional)</label>
                <textarea
                  rows={2}
                  value={editTeaserModal.description}
                  onChange={e => setEditTeaserModal(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe recent progress milestones or features added..."
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '10px', color: 'white', fontSize: '0.88rem', resize: 'none' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setEditTeaserModal(prev => ({ ...prev, isOpen: false }))}
                  style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editTeaserModal.loading}
                  className="btn-primary"
                  style={{
                    flex: 2,
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.35)',
                    fontSize: '0.88rem'
                  }}
                >
                  {editTeaserModal.loading ? <Loader2 size={16} className="animate-spin" /> : <Sliders size={16} />}
                  {editTeaserModal.loading ? 'Updating...' : 'Save & Update Card'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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

      {/* Update App Modal */}
      <UpdateAppModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        app={selectedAppForUpdate}
        token={token}
        onSuccess={fetchData}
        allowGitHub={true}
      />
    </div>
  );
};

export default UserDashboard;
