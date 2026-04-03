import React, { useState } from 'react';
import { Upload, File, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const AdminUpload = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({ name: '', version: '', description: '', file_url: '', size: '' });
  const [files, setFiles] = useState({ icon: null });
  const [status, setStatus] = useState({ loading: false, success: false, error: null });
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.file_url) return setStatus({ ...status, error: 'Download link is required!' });

    setStatus({ loading: true, success: false, error: null });

    try {
      // 1. App URL is already in formData.file_url
      const fileUrl = formData.file_url;

      // 2. Upload Icon to Supabase (Optional)
      let iconUrl = null;
      if (files.icon) {
        const iconFileName = `${Date.now()}-${files.icon.name}`;
        const { data: iconData, error: iconError } = await supabase.storage
          .from('cstore-icons')
          .upload(iconFileName, files.icon);
        
        if (iconError) throw iconError;

        const { data: { publicUrl: iconPublicUrl } } = supabase.storage
          .from('cstore-icons')
          .getPublicUrl(iconFileName);
        iconUrl = iconPublicUrl;
      }

      // 3. Send metadata to backend
      const response = await fetch(`${config.API_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          version: formData.version,
          description: formData.description,
          file_url: fileUrl,
          icon_url: iconUrl,
          size: formData.size || 'Unknown'
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Upload failed!');
      }
      
      setStatus({ loading: false, success: true, error: null });
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setStatus({ loading: false, success: false, error: err.message });
    }
  };

  return (
    <div style={{ padding: '4rem 0', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Upload Application</h2>
        <p style={{ color: 'var(--text-muted)' }}>Fill in the details to add a new app to the store.</p>
      </header>

      <form onSubmit={handleSubmit} className="glass" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>App Name *</label>
            <input 
              type="text" name="name" required value={formData.name} onChange={handleInputChange} 
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'white' }}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Version (e.g., v1.0.0)</label>
            <input 
              type="text" name="version" value={formData.version} onChange={handleInputChange} 
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'white' }}
            />
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Detailed Description</label>
          <textarea 
            name="description" rows="4" value={formData.description} onChange={handleInputChange}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'white', resize: 'none' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>App Link (G-Drive/Direct) *</label>
            <input 
              type="url" name="file_url" required placeholder="https://drive.google.com/..." value={formData.file_url} onChange={handleInputChange} 
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'white' }}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>App Size (e.g., 750 MB)</label>
            <input 
              type="text" name="size" placeholder="750 MB" value={formData.size} onChange={handleInputChange} 
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'white' }}
            />
          </div>
        </div>

        <div className="file-upload" style={{ position: 'relative' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select Icon (Optional)</label>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed var(--glass-border)', borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer' }}>
            <input type="file" name="icon" accept="image/*" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            <ImageIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>{files.icon ? files.icon.name : 'Click to select icon image'}</p>
          </div>
        </div>

        {status.error && <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle size={18} /> {status.error}</div>}
        {status.success && <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={18} /> Upload Success! Redirecting...</div>}

        <button 
          type="submit" disabled={status.loading} 
          className="btn-primary" 
          style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}
        >
          {status.loading ? <><Loader2 size={24} className="animate-spin" /> Uploading...</> : <><Upload size={24} /> Publish Application</>}
        </button>
      </form>
    </div>
  );
};

export default AdminUpload;
