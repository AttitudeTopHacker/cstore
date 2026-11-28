import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Upload, File, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, X, GitBranch, Rocket, Download, Sparkles } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth, isAdminUser } from '../context/AuthContext';
import { parseApkMetadata, getAppCategory, cleanAppDescription, CATEGORIES } from '../utils/apkMetadata';

const UpdateAppModal = ({ isOpen, onClose, app, token, onSuccess, allowGitHub = false }) => {
  if (!isOpen || !app) return null;

  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [formData, setFormData] = useState({
    name: app.name || '',
    version: app.version || '',
    description: cleanAppDescription(app.description || ''),
    size: app.size || '',
  });
  const [category, setCategory] = useState(getAppCategory(app));

  const [files, setFiles] = useState({ icon: null, apk: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(''); // 'uploading_apk', 'uploading_icon', 'saving', 'done'
  const [isParsingApk, setIsParsingApk] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState(null);

  // GitHub Release Option State (for User Dashboard)
  const [apkSource, setApkSource] = useState('local'); // 'local' | 'github'
  const [githubRepo, setGithubRepo] = useState('');
  const [githubPat, setGithubPat] = useState(localStorage.getItem('cstore_gh_pat') || '');
  const [showPatInput, setShowPatInput] = useState(false);
  const [githubFetching, setGithubFetching] = useState(false);
  const [githubError, setGithubError] = useState('');
  const [githubRelease, setGithubRelease] = useState(null);

  useEffect(() => {
    setCategory(getAppCategory(app));
    setFormData({
      name: app.name || '',
      version: app.version || '',
      description: cleanAppDescription(app.description || ''),
      size: app.size || '',
    });
    setFiles({ icon: null, apk: null });
    setError(null);
    setUploadProgress(0);
    setUploadStatus('');
    setApkSource('local');
    setGithubRepo(app.github_repo || app.github_repo_url || '');
    setGithubRelease(null);
    setGithubError('');
    setIsParsingApk(false);
    setExtractedInfo(null);
  }, [app]);

  const handleFetchRelease = async (repoInput) => {
    let cleanRepo = (repoInput || '').trim();
    cleanRepo = cleanRepo.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    if (!cleanRepo || !cleanRepo.includes('/')) {
      setGithubError('Enter valid repository: owner/repo (e.g. AttitudeTopHacker/cstore)');
      return;
    }

    setGithubFetching(true);
    setGithubError('');
    setGithubRelease(null);
    try {
      const headers = { 'Accept': 'application/vnd.github.v3+json' };
      const pat = (githubPat || '').trim();
      if (pat) {
        localStorage.setItem('cstore_gh_pat', pat);
        headers['Authorization'] = `Bearer ${pat}`;
      }

      const res = await fetch(`https://api.github.com/repos/${cleanRepo}/releases/latest`, { headers });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(pat ? 'Release or repository not found. Verify repo name and permissions.' : 'Repository not found or Private. Enter your GitHub Token below.');
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

      setGithubRelease({
        tagName: data.tag_name,
        apkName: apkAsset.name,
        apkSize: (apkAsset.size / (1024 * 1024)).toFixed(1) + ' MB',
        downloadUrl: apkAsset.browser_download_url
      });

      // Suggest the release tag as version
      if (data.tag_name) {
        setFormData(prev => ({
          ...prev,
          version: data.tag_name,
          size: `${(apkAsset.size / (1024 * 1024)).toFixed(1)} MB`
        }));
      }
    } catch (err) {
      setGithubError(err.message);
    } finally {
      setGithubFetching(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'name') {
      const filtered = value.replace(/[^a-zA-Z0-9 ]/g, '');
      setFormData({ ...formData, name: filtered });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (e.target.name === 'apk' && file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      if (parseFloat(sizeMB) > 500) {
        alert(`This file is ${sizeMB}MB. Our server supports up to 500MB via chunked upload.`);
        return;
      }
      setFormData(prev => ({ ...prev, size: `${sizeMB} MB` }));
      setFiles(prev => ({ ...prev, apk: file }));
      setIsParsingApk(true);
      setExtractedInfo(null);

      try {
        const meta = await parseApkMetadata(file);
        if (meta) {
          setExtractedInfo(meta);
          if (meta.version) {
            setFormData(prev => ({ ...prev, version: meta.version }));
          }
          if (meta.iconFile && !files.icon) {
            setFiles(prev => ({ ...prev, icon: meta.iconFile }));
          }
        }
      } catch (err) {
        console.warn('APK parse in UpdateModal:', err);
      } finally {
        setIsParsingApk(false);
      }
    } else {
      setFiles(prev => ({ ...prev, [e.target.name]: file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError('App name is required!');
    if (!/^[a-zA-Z0-9 ]+$/.test(formData.name.trim())) {
      return setError('App name can only contain letters, numbers, and spaces.');
    }

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      let finalFileUrl = app.file_url;
      let finalSize = app.size;
      let isChunked = app.is_chunked;
      let chunkCount = app.chunk_count;

      let uploadTargetFile = files.apk;

      // In Option B (GitHub Release), stream directly from GitHub!
      if (!uploadTargetFile && allowGitHub && apkSource === 'github' && githubRelease) {
        setUploadStatus('uploading_apk');
        setUploadProgress(5);
        let blob = null;

        try {
          const proxyRes = await fetch(`/api/download-github-apk?url=${encodeURIComponent(githubRelease.downloadUrl)}`, {
            headers: githubPat ? { 'x-github-token': githubPat } : {}
          });
          if (proxyRes.ok) blob = await proxyRes.blob();
        } catch (_) {}

        if (!blob) {
          try {
            const directRes = await fetch(githubRelease.downloadUrl);
            if (directRes.ok) blob = await directRes.blob();
          } catch (_) {}
        }

        if (blob) {
          uploadTargetFile = new File([blob], githubRelease.apkName, { type: 'application/vnd.android.package-archive' });
        }
      }

      // 1. Upload APK if selected or streamed from GitHub
      if (uploadTargetFile) {
        setUploadStatus('uploading_apk');
        const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
        const fileSize = uploadTargetFile.size;
        finalSize = `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;

        if (fileSize > CHUNK_SIZE) {
          isChunked = true;
          chunkCount = Math.ceil(fileSize / CHUNK_SIZE);
          const chunkAppId = `chunked_${Date.now()}`;
          
          for (let i = 0; i < chunkCount; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const chunk = uploadTargetFile.slice(start, end);
            const chunkName = `${chunkAppId}_part_${i}`;
            
            const { error: uploadError } = await supabase.storage
              .from('cstore-apps')
              .upload(chunkName, chunk);
            
            if (uploadError) throw uploadError;
            const progress = Math.round(((i + 1) / chunkCount) * 100);
            setUploadProgress(progress);
          }

          const { data: { publicUrl } } = supabase.storage
            .from('cstore-apps')
            .getPublicUrl(chunkAppId);
          
          finalFileUrl = publicUrl;
        } else {
          isChunked = false;
          chunkCount = 1;
          const apkFileName = `${Date.now()}-${uploadTargetFile.name.replace(/\s+/g, '_')}`;
          const { error: apkError } = await supabase.storage
            .from('cstore-apps')
            .upload(apkFileName, uploadTargetFile, {
              onUploadProgress: (p) => {
                const percent = Math.round((p.loaded / p.total) * 100);
                setUploadProgress(percent);
              }
            });

          if (apkError) throw apkError;
          const { data: { publicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(apkFileName);
          finalFileUrl = publicUrl;
        }
      }

      // 2. Upload Icon if selected
      let finalIconUrl = app.icon_url;
      if (files.icon) {
        setUploadStatus('uploading_icon');
        setUploadProgress(0);
        const iconFileName = `${Date.now()}-${files.icon.name.replace(/\s+/g, '_')}`;
        const { error: iconError } = await supabase.storage.from('cstore-icons').upload(iconFileName, files.icon);
        if (iconError) throw iconError;
        const { data: { publicUrl } } = supabase.storage.from('cstore-icons').getPublicUrl(iconFileName);
        finalIconUrl = publicUrl;
      }

      // 3. Archive previous version in app_history and update app in Supabase
      setUploadStatus('saving');
      try {
        await supabase.from('app_history').insert([{
          app_id: app.id,
          version: app.version || 'v1.0.0',
          file_url: app.file_url,
          size: app.size || 'Unknown',
          description: app.description || ''
        }]);
      } catch (histErr) {
        console.warn('History archive notice:', histErr.message);
      }

      const cleanDesc = cleanAppDescription(formData.description || '').trim();
      const finalDescription = `[Category: ${category}]\n\n${cleanDesc}`;

      const { error: updateError } = await supabase.from('apps').update({
        name: formData.name,
        version: formData.version,
        description: finalDescription,
        file_url: finalFileUrl,
        icon_url: finalIconUrl,
        size: formData.size,
        is_chunked: isChunked,
        chunk_count: chunkCount,
        upload_source: apkSource === 'github' ? 'github' : (app.upload_source || 'manual'),
        ...(isAdmin ? {
          updated_by_admin: true,
          last_updated_by: `Admin (${user?.email || 'mohdsalman4151@gmail.com'})`
        } : {
          updated_by_admin: false,
          last_updated_by: null
        }),
        updated_at: new Date().toISOString()
      }).eq('id', app.id);

      if (updateError) throw updateError;

      setUploadStatus('done');
      // User dismisses modal using Done or X button
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during update.');
      setLoading(false);
    }
  };

  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="modal-backdrop-in"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 23, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          padding: '1rem',
          overflowY: 'auto'
        }}
      >
        {/* Card Container */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="glass modal-card-in"
          style={{
            padding: 'clamp(1.25rem, 3.5vw, 2.2rem)',
            borderRadius: '24px',
            maxWidth: '650px',
            width: '100%',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#0b0f19'
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={18} />
          </button>

          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: 'white' }}>Update Application</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Modify details or upload a newer APK build for <strong>{app.name}</strong>.
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}>
              {uploadStatus === 'done' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                  <CheckCircle size={56} color="#10b981" />
                  <h3 style={{ fontSize: '1.25rem', color: 'white' }}>Update Complete!</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Application build and metadata have been updated successfully.</p>
                  <button
                    type="button"
                    onClick={() => {
                      onSuccess();
                      onClose();
                    }}
                    style={{
                      padding: '10px 32px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    <CheckCircle size={16} /> Done
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                  <Loader2 size={48} color="#6366f1" className="animate-spin" />
                  <div>
                    <h3 style={{ fontSize: '1.15rem', color: 'white', marginBottom: '0.4rem' }}>
                      {uploadStatus === 'uploading_apk' && 'Uploading APK Build...'}
                      {uploadStatus === 'uploading_icon' && 'Uploading App Icon...'}
                      {uploadStatus === 'saving' && 'Saving updates...'}
                    </h3>
                    {(uploadStatus === 'uploading_apk' || uploadStatus === 'uploading_icon') && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Progress: {uploadProgress}%</p>
                    )}
                  </div>
                  {(uploadStatus === 'uploading_apk' || uploadStatus === 'uploading_icon') && (
                    <div style={{ width: '80%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: '3px', transition: 'width 0.2s ease' }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="modal-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>App Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '11px 14px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.92rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Version (e.g. v1.1.0) *</label>
                  <input
                    type="text"
                    name="version"
                    required
                    value={formData.version}
                    onChange={handleInputChange}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '11px 14px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.92rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', padding: '11px 14px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.92rem', cursor: 'pointer' }}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat} style={{ background: '#0f172a', color: 'white' }}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Description</label>
                <textarea
                  name="description"
                  rows="3"
                  value={formData.description}
                  onChange={handleInputChange}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: '0.95rem' }}
                />
              </div>

              {/* If allowGitHub is enabled (User Dashboard), show Tab Selector */}
              {allowGitHub && (
                <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    type="button"
                    onClick={() => setApkSource('local')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: apkSource === 'local' ? 'var(--primary)' : 'transparent',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Upload size={13} /> Option A: Local Directory File
                  </button>
                  <button
                    type="button"
                    onClick={() => setApkSource('github')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: apkSource === 'github' ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <GitBranch size={13} /> Option B: GitHub Release
                  </button>
                </div>
              )}

              {/* GitHub Release Fetcher Box (only if allowGitHub && apkSource === 'github') */}
              {allowGitHub && apkSource === 'github' && (
                <div style={{ background: 'rgba(99, 102, 241, 0.06)', borderRadius: '14px', padding: '1rem', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 600 }}>
                    GitHub Repository (owner/repo)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="e.g. AttitudeTopHacker/cstore"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '0.88rem' }}
                    />
                    <button
                      type="button"
                      disabled={githubFetching}
                      onClick={() => handleFetchRelease(githubRepo)}
                      className="btn-primary"
                      style={{ padding: '9px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}
                    >
                      {githubFetching ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Fetch Release
                    </button>
                  </div>

                  {/* Private Repo PAT toggle */}
                  <div style={{ marginBottom: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowPatInput(!showPatInput)}
                      style={{ background: 'none', border: 'none', color: '#a5b4fc', fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                    >
                      🔑 Private Repo? {showPatInput ? 'Hide Token' : 'Add GitHub Access Token'}
                    </button>
                    {showPatInput && (
                      <div style={{ marginTop: '0.35rem' }}>
                        <input
                          type="password"
                          placeholder="GitHub Personal Access Token (ghp_...)"
                          value={githubPat}
                          onChange={(e) => setGithubPat(e.target.value)}
                          style={{ width: '100%', padding: '7px 11px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                          Saved in browser localStorage. Requires only repo/contents read access.
                        </span>
                      </div>
                    )}
                  </div>

                  {githubError && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.3rem' }}>{githubError}</div>
                  )}

                  {githubRelease && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '0.85rem', marginTop: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.88rem' }}>
                          ✓ Detected: {githubRelease.tagName} ({githubRelease.apkSize})
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          File: {githubRelease.apkName}
                        </div>
                      </div>
                      <a
                        href={githubRelease.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.78rem',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.1)',
                          color: 'white',
                          textDecoration: 'none',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Download size={12} /> Download APK
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* If in GitHub mode, only Icon upload is shown; if in Local mode (or Admin Panel), both APK file and Icon are shown */}
              {allowGitHub && apkSource === 'github' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>New Icon (Optional)</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="file"
                      name="icon"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', overflow: 'hidden' }}>
                      <ImageIcon size={16} style={{ flexShrink: 0 }} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {files.icon ? files.icon.name : 'Select image icon to update'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  {/* APK Upload (Optional) */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>New APK File (Optional)</label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="file"
                        name="apk"
                        accept=".apk"
                        onChange={handleFileChange}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', zIndex: 2 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', overflow: 'hidden' }}>
                        {isParsingApk ? (
                          <Loader2 size={16} className="animate-spin" style={{ color: '#c084fc', flexShrink: 0 }} />
                        ) : (
                          <File size={16} style={{ flexShrink: 0, color: files.apk ? '#a855f7' : 'inherit' }} />
                        )}
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {isParsingApk ? 'Reading newer APK...' : files.apk ? files.apk.name : 'Select newer .apk'}
                        </span>
                      </div>
                    </div>
                    {extractedInfo && (
                      <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Sparkles size={11} /> Auto-filled version {formData.version} ({formData.size})
                      </div>
                    )}
                  </div>

                  {/* Icon Upload (Optional) */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>New Icon (Optional)</label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="file"
                        name="icon"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', overflow: 'hidden' }}>
                        <ImageIcon size={16} style={{ flexShrink: 0 }} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {files.icon ? files.icon.name : 'Select image icon'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', background: 'var(--accent-gradient)', border: 'none', color: 'white', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}
                >
                  Update & Record
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default UpdateAppModal;
