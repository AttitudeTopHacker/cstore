import React, { useState } from 'react';
import { Upload, File, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import ProgressModal from '../components/ProgressModal';
import { parseApkMetadata } from '../utils/apkMetadata';

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

const UploadApp = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ name: '', version: '', description: '', size: '' });
  const [category, setCategory] = useState('Tools');
  const [files, setFiles] = useState({ icon: null, apk: null });
  const [iconPreview, setIconPreview] = useState(null);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [isParsingApk, setIsParsingApk] = useState(false);
  const [status, setStatus] = useState({ loading: false, success: false, error: null });
  const [modal, setModal] = useState({ isOpen: false, type: 'upload', progress: 0, fileName: '', fileSize: '', status: 'active', error: '' });

  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'name') {
      const filtered = value.replace(/[^a-zA-Z0-9 ]/g, '');
      setFormData({ ...formData, name: filtered });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleApkFile = async (file) => {
    if (!file) return;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

    if (parseFloat(sizeMB) > 500) {
      alert(`This file is ${sizeMB}MB. Our server supports up to 500MB via chunked upload.`);
      return;
    }

    setFiles(prev => ({ ...prev, apk: file }));
    setFormData(prev => ({ ...prev, size: `${sizeMB} MB` }));
    setIsParsingApk(true);
    setExtractedInfo(null);

    try {
      const meta = await parseApkMetadata(file);
      if (meta) {
        setExtractedInfo(meta);
        setFormData(prev => ({
          ...prev,
          name: meta.name ? meta.name.replace(/[^a-zA-Z0-9 ]/g, '') : prev.name,
          version: meta.version || prev.version || 'v1.0.0',
          size: meta.size || `${sizeMB} MB`
        }));

        if (meta.iconFile && meta.iconDataUrl) {
          setFiles(prev => ({ ...prev, icon: meta.iconFile }));
          setIconPreview(meta.iconDataUrl);
        }
      }
    } catch (err) {
      console.warn('APK extraction warning:', err);
    } finally {
      setIsParsingApk(false);
    }
  };

  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, icon: file }));
      setIconPreview(URL.createObjectURL(file));
      setExtractedInfo(prev => prev ? { ...prev, userCustomIcon: true } : null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return setStatus({ ...status, error: 'App name is required!' });
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(formData.name.trim())) {
      return setStatus({ ...status, error: 'App name can only contain letters, numbers, and spaces.' });
    }
    if (!files.apk) {
      return setStatus({ ...status, error: 'Please select an APK file to upload!' });
    }

    setStatus({ loading: true, success: false, error: null });

    try {
      let finalFileUrl = '';
      let isChunked = false;
      let chunkCount = 1;

      // Upload APK
      setModal({
        isOpen: true,
        type: 'upload',
        progress: 0,
        fileName: files.apk.name,
        fileSize: formData.size,
        status: 'active',
        error: ''
      });

      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
      const fileSize = files.apk.size;

      if (fileSize > CHUNK_SIZE) {
        isChunked = true;
        chunkCount = Math.ceil(fileSize / CHUNK_SIZE);
        const appId = `chunked_${Date.now()}`;

        for (let i = 0; i < chunkCount; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileSize);
          const chunk = files.apk.slice(start, end);
          const chunkName = `${appId}_part_${i}`;

          const { error: uploadError } = await supabase.storage
            .from('cstore-apps')
            .upload(chunkName, chunk);

          if (uploadError) throw uploadError;
          const totalProgress = Math.round(((i + 1) / chunkCount) * 100);
          setModal(prev => ({ ...prev, progress: totalProgress }));
        }

        const { data: { publicUrl } } = supabase.storage
          .from('cstore-apps')
          .getPublicUrl(appId);

        finalFileUrl = publicUrl;
      } else {
        const apkFileName = `${Date.now()}-${files.apk.name.replace(/\s+/g, '_')}`;
        const { error: apkError } = await supabase.storage
          .from('cstore-apps')
          .upload(apkFileName, files.apk, {
            onUploadProgress: (p) => {
              const percent = Math.round((p.loaded / p.total) * 100);
              setModal(prev => ({ ...prev, progress: percent }));
            }
          });

        if (apkError) throw apkError;
        const { data: { publicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(apkFileName);
        finalFileUrl = publicUrl;
      }
      setModal(prev => ({ ...prev, status: 'success', progress: 100 }));

      let iconUrl = null;
      if (files.icon) {
        const iconFileName = `${Date.now()}-${files.icon.name.replace(/\s+/g, '_')}`;
        const { error: iconError } = await supabase.storage.from('cstore-icons').upload(iconFileName, files.icon);
        if (iconError) {
          // fallback to cstore-apps bucket if cstore-icons fails
          const { error: fbErr } = await supabase.storage.from('cstore-apps').upload(iconFileName, files.icon);
          if (!fbErr) {
            const { data: { publicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(iconFileName);
            iconUrl = publicUrl;
          }
        } else {
          const { data: { publicUrl } } = supabase.storage.from('cstore-icons').getPublicUrl(iconFileName);
          iconUrl = publicUrl;
        }
      }

      // Format description with category if provided
      let finalDescription = formData.description?.trim() || '';
      if (category && !finalDescription.includes(`[Category:`)) {
        finalDescription = `[Category: ${category}]\n\n${finalDescription}`.trim();
      }

      // Direct Supabase insert
      const { data: insertedApp, error: insertError } = await supabase.from('apps').insert([{
        name: formData.name,
        version: formData.version || 'v1.0.0',
        description: finalDescription,
        file_url: finalFileUrl,
        icon_url: iconUrl,
        size: formData.size || 'Unknown',
        is_chunked: isChunked || false,
        chunk_count: chunkCount || 1,
        user_id: user?.id || null,
        publisher_name: user?.name || user?.email?.split('@')[0] || 'User',
        publisher_email: user?.email || null,
        download_count: 0
      }]).select().single();

      if (insertError) throw insertError;
      const newAppId = insertedApp.id;

      if (newAppId && isChunked) {
        await supabase.from('apps').update({
          is_chunked: isChunked,
          chunk_count: chunkCount
        }).eq('id', newAppId);
      }

      setStatus({ loading: false, success: true, error: null });
    } catch (err) {
      console.error('Upload process failed:', err);
      setStatus({ loading: false, success: false, error: err.message });
      if (modal.isOpen) {
        setModal(prev => ({ ...prev, status: 'error', error: err.message }));
      }
    }
  };

  return (
    <div style={{ padding: 'clamp(1rem, 3.5vw, 2rem) clamp(0.5rem, 2vw, 1rem)', maxWidth: '720px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 'clamp(1.4rem, 4.5vw, 1.85rem)', marginBottom: '0.35rem', fontWeight: 800 }}>Upload Application</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.8rem, 2.5vw, 0.88rem)', margin: 0 }}>
          Drop your APK to auto-fill details, then set your description and category.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="glass" style={{ padding: 'clamp(1.15rem, 3.5vw, 1.75rem)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* 1. Primary APK Dropzone with Auto-Fill Feature */}
        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
            <span>Application APK File *</span>
            <span style={{ fontSize: '0.74rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> Auto-detects Name, Version & Icon
            </span>
          </label>
          <div 
            style={{ 
              position: 'relative',
              background: files.apk ? 'rgba(99, 102, 241, 0.04)' : 'rgba(255,255,255,0.02)', 
              border: files.apk ? '2px solid rgba(99, 102, 241, 0.4)' : '2px dashed var(--glass-border)', 
              borderRadius: '14px', 
              padding: '1.25rem 1rem', 
              textAlign: 'center', 
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              minHeight: '120px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'; }}
            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = files.apk ? 'rgba(99, 102, 241, 0.4)' : 'var(--glass-border)'; e.currentTarget.style.background = files.apk ? 'rgba(99, 102, 241, 0.04)' : 'rgba(255,255,255,0.02)'; }}
            onDrop={(e) => { 
              e.preventDefault(); 
              e.currentTarget.style.borderColor = 'var(--glass-border)'; 
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              const file = e.dataTransfer.files[0];
              if (file && file.name.endsWith('.apk')) {
                handleApkFile(file);
              } else {
                alert('Please drop a valid .apk file');
              }
            }}
          >
            <input 
              type="file" name="apk" accept=".apk" 
              onChange={(e) => handleApkFile(e.target.files[0])}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }} 
            />

            {isParsingApk ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: '#a855f7' }}>
                <Loader2 size={28} className="animate-spin" />
                <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Reading APK metadata & extracting icon...</div>
              </div>
            ) : (
              <>
                <div style={{ 
                  width: '42px', height: '42px', borderRadius: '12px', 
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  marginBottom: '0.5rem'
                }}>
                  <File size={22} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'white', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {files.apk ? files.apk.name : 'Choose or Drag APK File'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {files.apk ? `File Size: ${formData.size}` : 'Up to 500MB • Fast client-side parsing'}
                </div>
                {files.apk && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={13} /> APK Loaded & Auto-Parsed
                  </div>
                )}
              </>
            )}
          </div>

          {/* Auto-extracted summary banner */}
          {extractedInfo && (
            <div style={{ 
              marginTop: '0.6rem', 
              padding: '0.6rem 0.9rem', 
              background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)', 
              border: '1px solid rgba(168, 85, 247, 0.3)', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.6rem', 
              fontSize: '0.8rem',
              color: '#e2e8f0'
            }}>
              <Sparkles size={16} style={{ color: '#c084fc', flexShrink: 0 }} />
              <div>
                <strong>Auto-filled:</strong> {formData.name || 'App'} • {formData.version || 'v1.0.0'} • {formData.size}
                {iconPreview ? ' • Icon extracted' : ''}
              </div>
            </div>
          )}
        </div>

        {/* 2. App Name & Version (Auto-filled, but fully editable) */}
        <div className="modal-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>App Name *</label>
            <input 
              type="text" name="name" required value={formData.name} onChange={handleInputChange} 
              placeholder="e.g. My App"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: '10px', color: 'white', fontSize: '0.9rem' }}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Version (e.g., v1.0.0)</label>
            <input 
              type="text" name="version" value={formData.version} onChange={handleInputChange} 
              placeholder="v1.0.0"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: '10px', color: 'white', fontSize: '0.9rem' }}
            />
          </div>
        </div>

        {/* 3. Category & App Icon row */}
        <div className="modal-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
          
          {/* Category Dropdown */}
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                padding: '10px 14px',
                borderRadius: '10px',
                color: 'white',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat} style={{ background: '#0f172a', color: 'white' }}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* App Icon preview or upload */}
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>App Icon</span>
              {iconPreview && (
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                  {extractedInfo?.userCustomIcon ? 'Custom Icon' : 'Extracted from APK'}
                </span>
              )}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '8px 12px', borderRadius: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {iconPreview ? (
                  <img src={iconPreview} alt="App Icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {files.icon ? files.icon.name : 'Default icon'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {files.icon ? 'Ready' : 'Will extract or use default'}
                </div>
              </div>
              <label style={{ 
                background: 'rgba(255,255,255,0.08)', 
                border: '1px solid rgba(255,255,255,0.15)', 
                borderRadius: '6px', 
                padding: '4px 8px', 
                fontSize: '0.75rem', 
                color: 'white', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <RefreshCw size={11} /> {iconPreview ? 'Change' : 'Upload'}
                <input type="file" accept="image/*" onChange={handleIconChange} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

        </div>

        {/* 4. Detailed Description (User-filled) */}
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
            Detailed Description
          </label>
          <textarea 
            name="description" rows="3" value={formData.description} onChange={handleInputChange}
            placeholder="Tell users what makes this app great! Include key features, update notes, or developer contact..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: '10px', color: 'white', resize: 'vertical', fontSize: '0.9rem' }}
          />
        </div>

        {status.error && (
          <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <AlertCircle size={16} /> {status.error}
          </div>
        )}
        {status.success && (
          <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <CheckCircle size={16} /> Upload Success! Redirecting...
          </div>
        )}

        <button 
          type="submit" disabled={status.loading || isParsingApk} 
          className="btn-primary" 
          style={{ width: '100%', padding: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontSize: '0.95rem', marginTop: '0.5rem' }}
        >
          {status.loading ? (
            <><Loader2 size={18} className="animate-spin" /> Uploading & Publishing...</>
          ) : (
            <><Upload size={18} /> Publish Application Live</>
          )}
        </button>
      </form>

      {/* Progress Modal */}
      <ProgressModal 
        {...modal}
        onCancel={() => setModal({ ...modal, status: 'cancelled' })}
        onRetry={handleSubmit}
        onClose={() => {
          setModal({ ...modal, isOpen: false });
          navigate('/apps');
        }}
      />
    </div>
  );
};

export default UploadApp;
