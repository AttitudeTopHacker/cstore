import React from 'react';
import { Download, Upload, X, RotateCcw, CheckCircle, AlertCircle, FileText } from 'lucide-react';

const ProgressModal = ({
  isOpen,
  type = 'download', // 'download' or 'upload'
  progress = 0,
  fileName = '',
  fileSize = '',
  status = 'active', // 'active', 'success', 'error', 'cancelled'
  onCancel,
  onRetry,
  onClose,
  error = ''
}) => {
  if (!isOpen) return null;

  const isDownload = type === 'download';
  
  const accentColor = isDownload ? '#6366f1' : '#a855f7';
  const accentGradient = isDownload 
    ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
    : 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '1.5rem',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '28px',
          padding: '2.5rem',
          maxWidth: '450px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Progress Background Glow */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          height: '200px',
          background: accentColor,
          filter: 'blur(100px)',
          opacity: 0.15,
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '22px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          }}>
            {status === 'success' ? (
              <CheckCircle size={40} color="#10b981" />
            ) : status === 'error' ? (
              <AlertCircle size={40} color="#ef4444" />
            ) : isDownload ? (
              <Download size={40} color={accentColor} className={status === 'active' ? 'animate-bounce' : ''} />
            ) : (
              <Upload size={40} color={accentColor} className={status === 'active' ? 'animate-bounce' : ''} />
            )}
          </div>

          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'white' }}>
            {status === 'success' ? (isDownload ? 'Download Complete' : 'Upload Complete') :
             status === 'error' ? 'Something went wrong' :
             status === 'cancelled' ? 'Operation Cancelled' :
             (isDownload ? 'Downloading Application...' : 'Uploading Application...')}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <FileText size={16} />
            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
            {fileSize && <span>({fileSize})</span>}
          </div>

          {/* Progress Bar Container */}
          {(status === 'active' || status === 'success') && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>
                <span style={{ color: accentColor }}>{progress}%</span>
                <span style={{ color: 'var(--text-muted)' }}>{status === 'success' ? '100%' : 'Processing...'}</span>
              </div>
              <div style={{
                height: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: accentGradient,
                  borderRadius: '10px',
                  transition: 'width 0.3s ease-out',
                  boxShadow: `0 0 15px ${accentColor}44`
                }} />
              </div>
            </div>
          )}

          {status === 'error' && (
            <p style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', fontSize: '0.9rem' }}>
              {error || 'An unexpected error occurred during the process.'}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {status === 'active' && (
              <button onClick={onCancel} style={{
                flex: 1,
                padding: '14px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <X size={18} /> Cancel
              </button>
            )}

            {(status === 'error' || status === 'cancelled') && (
              <>
                <button onClick={onRetry} style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '14px',
                  background: accentGradient,
                  color: 'white',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}>
                  <RotateCcw size={18} /> Retry
                </button>
                <button onClick={onClose} style={{
                  padding: '14px 24px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontWeight: 600
                }}>
                  Close
                </button>
              </>
            )}

            {status === 'success' && (
              <button onClick={onClose} style={{
                flex: 1,
                padding: '14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                fontWeight: 600,
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
              }}>
                Great!
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce {
          animation: bounce 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ProgressModal;
