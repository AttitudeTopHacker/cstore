import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Upload, File, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import config from '../config';

const UpdateAppModal = ({ isOpen, onClose, app, token, onSuccess }) => {
  if (!isOpen || !app) return null;

  const [formData, setFormData] = useState({
    name: app.name || '',
    version: app.version || '',
    description: app.description || '',
    size: app.size || '',
  });

  const [files, setFiles] = useState({ icon: null, apk: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(''); // 'uploading_apk', 'uploading_icon', 'saving', 'done'

  useEffect(() => {
    setFormData({
      name: app.name || '',
      version: app.version || '',
      description: app.description || '',
      size: app.size || '',
    });
    setFiles({ icon: null, apk: null });
    setError(null);
    setUploadProgress(0);
    setUploadStatus('');
  }, [app]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'name') {
      const filtered = value.replace(/[^a-zA-Z ]/g, '');
      setFormData({ ...formData, name: filtered });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (e.target.name === 'apk' && file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      if (parseFloat(sizeMB) > 500) {
        alert(`This file is ${sizeMB}MB. Our server supports up to 500MB via chunked upload.`);
        return;
      }
      setFormData(prev => ({ ...prev, size: `${sizeMB} MB` }));
      setFiles({ ...files, apk: file });
    } else {
      setFiles({ ...files, [e.target.name]: file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError('App name is required!');
    if (!/^[a-zA-Z ]+$/.test(formData.name.trim())) {
      return setError('App name can only contain letters and spaces.');
    }

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      let finalFileUrl = app.file_url;
      let finalSize = app.size;
      let isChunked = app.is_chunked;
      let chunkCount = app.chunk_count;

      // 1. Upload APK if selected
      if (files.apk) {
        setUploadStatus('uploading_apk');
        const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
        const fileSize = files.apk.size;

        if (fileSize > CHUNK_SIZE) {
          isChunked = true;
          chunkCount = Math.ceil(fileSize / CHUNK_SIZE);
          const chunkAppId = `chunked_${Date.now()}`;
          
          for (let i = 0; i < chunkCount; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const chunk = files.apk.slice(start, end);
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
          const apkFileName = `${Date.now()}-${files.apk.name.replace(/\s+/g, '_')}`;
          const { error: apkError } = await supabase.storage
            .from('cstore-apps')
            .upload(apkFileName, files.apk, {
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

      // 3. Update App via Backend API
      setUploadStatus('saving');
      const response = await fetch(`${config.API_BASE_URL}/apps/${app.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          version: formData.version,
          description: formData.description,
          file_url: finalFileUrl,
          icon_url: finalIconUrl,
          size: formData.size,
          is_chunked: isChunked,
          chunk_count: chunkCount
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update application');
      }

      setUploadStatus('done');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
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
          padding: '1.5rem',
          overflowY: 'auto'
        }}
      >
        {/* Card Container */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '2.5rem',
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <CheckCircle size={56} color="#10b981" />
                  <h3 style={{ fontSize: '1.25rem', color: 'white' }}>Update Complete!</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Refreshing dashboard...</p>
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
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>App Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Version (e.g. v1.1.0) *</label>
                  <input
                    type="text"
                    name="version"
                    required
                    value={formData.version}
                    onChange={handleInputChange}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.95rem' }}
                  />
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
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', overflow: 'hidden' }}>
                      <File size={16} style={{ flexShrink: 0 }} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {files.apk ? files.apk.name : 'Select newer .apk'}
                      </span>
                    </div>
                  </div>
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
