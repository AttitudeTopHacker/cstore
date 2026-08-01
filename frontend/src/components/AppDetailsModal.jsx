import React from 'react';
import { X, Download, LayoutGrid } from 'lucide-react';

const AppDetailsModal = ({ isOpen, onClose, app, onDownload }) => {
  if (!isOpen || !app) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1.5rem',
        }}
      >
        {/* Modal Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="glass"
          style={{
            padding: '2.5rem',
            borderRadius: '24px',
            maxWidth: '550px',
            width: '100%',
            position: 'relative',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '1px solid var(--glass-border)'
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
              transition: 'all 0.2s',
              zIndex: 10
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={18} />
          </button>

          {/* Header Info */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '22px', 
              background: 'rgba(255,255,255,0.03)', overflow: 'hidden',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
              flexShrink: 0
            }}>
              {app.icon_url ? <img src={app.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LayoutGrid size={36} style={{ margin: '22px', opacity: 0.5 }} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.6rem', color: 'white', marginBottom: '0.4rem' }}>{app.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>{app.version}</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--glass-border)' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{app.size}</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--glass-border)' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Download size={14} /> {app.download_count} downloads
                </span>
              </div>
            </div>
          </div>

          <h4 style={{ fontSize: '1rem', color: 'white', marginBottom: '0.75rem', fontWeight: 600 }}>Description</h4>
          
          {/* Scrollable Description Container */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem', marginBottom: '2rem' }}>
            <p style={{ 
              color: 'var(--text-muted)', 
              fontSize: '0.95rem', 
              lineHeight: 1.6, 
              margin: 0,
              whiteSpace: 'pre-wrap'
            }}>
              {app.description || 'Elevate your experience with this premium utility designed for modern Android devices.'}
            </p>
          </div>

          {/* Footer Action */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{ 
                flex: 1, 
                padding: '12px 20px', 
                borderRadius: '12px', 
                background: 'rgba(255,255,255,0.05)', 
                border: '1px solid var(--glass-border)', 
                color: 'var(--text-muted)', 
                fontSize: '0.95rem', 
                cursor: 'pointer', 
                fontFamily: 'inherit', 
                fontWeight: 600 
              }}
            >
              Back to Store
            </button>
            <button
              onClick={() => {
                onDownload(app);
                onClose();
              }}
              style={{ 
                flex: 1, 
                padding: '12px 20px', 
                borderRadius: '12px', 
                background: 'var(--accent-gradient)', 
                border: 'none', 
                color: 'white', 
                fontSize: '0.95rem', 
                cursor: 'pointer', 
                fontFamily: 'inherit', 
                fontWeight: 700, 
                boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Download size={16} /> Install Now
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AppDetailsModal;
