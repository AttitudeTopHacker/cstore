import React, { useState } from 'react';
import { Upload, File, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import ProgressModal from '../components/ProgressModal';


const AdminUpload = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({ name: '', version: '', description: '', file_url: '', size: '' });
  const [files, setFiles] = useState({ icon: null, apk: null });
  const [status, setStatus] = useState({ loading: false, success: false, error: null });
  const [modal, setModal] = useState({ isOpen: false, type: 'upload', progress: 0, fileName: '', fileSize: '', status: 'active', error: '' });

  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (e.target.name === 'apk' && file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      
      if (parseFloat(sizeMB) > 500) {
        alert(`This file is ${sizeMB}MB. For files over 500MB, please use a Drive link instead.`);
        setFiles({ ...files, apk: null });
        return;
      }


      setFormData(prev => ({ ...prev, size: `${sizeMB} MB` }));
      setFiles({ ...files, [e.target.name]: file });
    } else {
      setFiles({ ...files, [e.target.name]: file });
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.apk && !formData.file_url) return setStatus({ ...status, error: 'Please select an APK file or provide a download link!' });

    setStatus({ loading: true, success: false, error: null });


    
    try {
      let finalFileUrl = formData.file_url;
      let isChunked = false;
      let chunkCount = 1;

      // 1. Handle APK Upload
      if (files.apk) {
        setModal({
          isOpen: true,
          type: 'upload',
          progress: 0,
          fileName: files.apk.name,
          fileSize: formData.size,
          status: 'active',
          error: ''
        });

        const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks (safer for memory)

        const fileSize = files.apk.size;
        
        if (fileSize > CHUNK_SIZE) {
          // CHUNKED UPLOAD
          isChunked = true;
          chunkCount = Math.ceil(fileSize / CHUNK_SIZE);
          const appId = `chunked_${Date.now()}`;
          
          for (let i = 0; i < chunkCount; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const chunk = files.apk.slice(start, end);
            const chunkName = `${appId}_part_${i}`; // Root path
            
            const { error: uploadError } = await supabase.storage
              .from('cstore-apps')
              .upload(chunkName, chunk);
            
            if (uploadError) throw uploadError;
            
            // Update progress
            const totalProgress = Math.round(((i + 1) / chunkCount) * 100);
            setModal(prev => ({ ...prev, progress: totalProgress }));
          }

          const { data: { publicUrl } } = supabase.storage.from('cstore-apps').getPublicUrl(appId);
          finalFileUrl = publicUrl;

        } else {
          // SINGLE FILE UPLOAD
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
      }

      let iconUrl = null;
      if (files.icon) {
        const iconFileName = `${Date.now()}-${files.icon.name.replace(/\s+/g, '_')}`;
        const { error: iconError } = await supabase.storage.from('cstore-icons').upload(iconFileName, files.icon);
        if (iconError) throw iconError;
        const { data: { publicUrl } } = supabase.storage.from('cstore-icons').getPublicUrl(iconFileName);
        iconUrl = publicUrl;
      }

      // 3. Metadata
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
          file_url: finalFileUrl,
          icon_url: iconUrl,
          size: formData.size || 'Unknown',
          is_chunked: isChunked,
          chunk_count: chunkCount
        }),
      });


      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Upload failed!');
      }

      const result = await response.json();
      const newAppId = result.id || (result.app && result.app.id);
      
      if (newAppId) {
        // DIRECT UPDATE (Ensures chunk metadata is synced even if backend had issues)
        await supabase.from('apps').update({
          is_chunked: isChunked,
          chunk_count: chunkCount
        }).eq('id', newAppId);
      }
      
      setStatus({ loading: false, success: true, error: null });
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      console.error('Upload process failed:', err);
      setStatus({ loading: false, success: false, error: err.message });
      if (modal.isOpen) {
        setModal(prev => ({ ...prev, status: 'error', error: err.message }));
      }
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

        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload APK File *</label>
          <div style={{ position: 'relative' }}>
            <div style={{ 
              background: 'rgba(255,255,255,0.02)', 
              border: '2px dashed var(--glass-border)', 
              borderRadius: '20px', 
              padding: '3rem 2rem', 
              textAlign: 'center', 
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            >
              <input type="file" name="apk" accept=".apk" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', 
                background: 'rgba(99, 102, 241, 0.1)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                margin: '0 auto 1.5rem' 
              }}>
                <File size={32} style={{ color: 'var(--primary)' }} />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{files.apk ? files.apk.name : 'Drop your APK here'}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{files.apk ? `Size: ${formData.size}` : 'Maximum file size: 500MB'}</p>
            </div>
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

      {/* Progress Modal */}
      <ProgressModal 
        {...modal}
        onCancel={() => setModal({ ...modal, status: 'cancelled' })}
        onRetry={handleSubmit}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
};


export default AdminUpload;
