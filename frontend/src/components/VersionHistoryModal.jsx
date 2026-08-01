import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Download, AlertCircle, Loader2, X, Clock, FileText } from 'lucide-react';
import config from '../config';

const VersionHistoryModal = ({ isOpen, onClose, app, onDownloadOld }) => {
  if (!isOpen || !app) return null;

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${config.API_BASE_URL}/apps/${app.id}/history`);
        if (!response.ok) throw new Error('Failed to load version history.');
        const data = await response.json();
        setHistory(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [app]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        }}
      >
        {/* Card Container */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '2.5rem',
            borderRadius: '24px',
            maxWidth: '550px',
            width: '100%',
            position: 'relative',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(99, 102, 241, 0.2)', /* Subtle primary blue border */
            background: '#0b132b' /* Solid premium dark blueish background */
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

          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Clock size={24} color="#6366f1" /> Version History
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Updates & release records for <strong>{app.name}</strong>.
          </p>

          {/* Content Area */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            {loading ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={36} color="#6366f1" className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                <p>Loading history records...</p>
              </div>
            ) : error ? (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>No historical updates recorded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {history.map((record, index) => (
                  <div 
                    key={record.id} 
                    className="glass" 
                    style={{ 
                      padding: '1.25rem', 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: index === 0 ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.01)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ 
                          fontSize: '1rem', 
                          fontWeight: 700, 
                          color: index === 0 ? '#818cf8' : 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}>
                          {record.version} 
                          {index === 0 && (
                            <span style={{ background: 'rgba(129,140,248,0.2)', color: '#c7d2fe', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>Active</span>
                          )}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> {formatDate(record.updated_at)}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => onDownloadOld(record)}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--glass-border)',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--accent-gradient)';
                          e.currentTarget.style.border = 'none';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.border = '1px solid var(--glass-border)';
                        }}
                      >
                        <Download size={13} /> {record.size}
                      </button>
                    </div>

                    {record.description && (
                      <p style={{ 
                        color: 'rgba(255,255,255,0.7)', 
                        fontSize: '0.85rem', 
                        lineHeight: 1.5,
                        margin: 0,
                        padding: '8px 10px',
                        background: 'rgba(0,0,0,0.15)',
                        borderRadius: '8px',
                        borderLeft: '2px solid rgba(255,255,255,0.1)'
                      }}>
                        {record.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default VersionHistoryModal;
