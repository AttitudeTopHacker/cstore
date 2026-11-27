import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Upload, X, RotateCcw, CheckCircle, AlertCircle, FileText, Sparkles, ShieldCheck } from 'lucide-react';

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
  const [isClosing, setIsClosing] = useState(false);
  const [rendered, setRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      setIsClosing(false);
    } else if (!isClosing) {
      setRendered(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setRendered(false);
      if (onClose) onClose();
    }, 220);
  };

  if (!rendered && !isOpen) return null;

  const isDownload = type === 'download';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isCancelled = status === 'cancelled';

  return createPortal(
    <div
      className={isClosing ? "modal-backdrop-out" : "modal-backdrop-in"}
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
      onClick={isSuccess ? handleClose : undefined}
    >
      <div
        className={isClosing ? "modal-card-out" : "modal-card-in"}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0b132b',
          border: isSuccess 
            ? '1px solid rgba(16, 185, 129, 0.4)' 
            : isError 
            ? '1px solid rgba(239, 68, 68, 0.4)' 
            : '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '26px',
          padding: '2.25rem 2rem',
          maxWidth: '460px',
          width: '100%',
          boxShadow: isSuccess
            ? '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(16, 185, 129, 0.2)'
            : '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 40px rgba(99, 102, 241, 0.25)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient Top Glow */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '220px',
          height: '220px',
          background: isSuccess ? '#10b981' : isError ? '#ef4444' : '#6366f1',
          filter: 'blur(90px)',
          opacity: 0.2,
          pointerEvents: 'none',
          zIndex: 0
        }} />

        {/* Top-Right Dismiss Button */}
        <button
          onClick={status === 'active' ? onCancel : handleClose}
          title="Dismiss"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.2s',
            zIndex: 2
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
        >
          <X size={15} />
        </button>

        <div style={{ position: 'relative', zIndex: 1 }}>
          
          {/* Top Engine Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '3px 12px',
            borderRadius: '16px',
            background: isSuccess 
              ? 'rgba(16, 185, 129, 0.12)' 
              : 'rgba(99, 102, 241, 0.12)',
            border: isSuccess 
              ? '1px solid rgba(16, 185, 129, 0.3)' 
              : '1px solid rgba(99, 102, 241, 0.3)',
            marginBottom: '1.25rem'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isSuccess ? '#10b981' : isError ? '#ef4444' : '#38bdf8',
              boxShadow: `0 0 8px ${isSuccess ? '#10b981' : isError ? '#ef4444' : '#38bdf8'}`
            }} />
            <span style={{
              fontSize: '0.70rem',
              fontWeight: 800,
              color: isSuccess ? '#34d399' : '#a5b4fc',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}>
              {isSuccess ? (isDownload ? 'Secure Download Complete' : 'Secure Upload Complete') : (isDownload ? 'Seamless In-Page Engine' : 'Direct Supabase Cloud Engine')}
            </span>
          </div>

          {/* Glowing Center Icon */}
          <div style={{
            width: '74px',
            height: '74px',
            borderRadius: '22px',
            background: isSuccess 
              ? 'rgba(16, 185, 129, 0.12)' 
              : isError 
              ? 'rgba(239, 68, 68, 0.12)' 
              : 'rgba(99, 102, 241, 0.12)',
            border: isSuccess 
              ? '2px solid rgba(16, 185, 129, 0.35)' 
              : isError 
              ? '2px solid rgba(239, 68, 68, 0.35)' 
              : '2px solid rgba(99, 102, 241, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: isSuccess
              ? '0 0 25px rgba(16, 185, 129, 0.3)'
              : '0 0 25px rgba(99, 102, 241, 0.3)',
          }}>
            {isSuccess ? (
              <CheckCircle size={38} color="#10b981" />
            ) : isError ? (
              <AlertCircle size={38} color="#ef4444" />
            ) : isDownload ? (
              <Download size={36} color="#818cf8" className="animate-pulse" />
            ) : (
              <Upload size={36} color="#818cf8" className="animate-pulse" />
            )}
          </div>

          {/* Heading */}
          <h3 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.4rem', color: 'white', letterSpacing: '-0.02em' }}>
            {isSuccess ? (isDownload ? 'Package Downloaded!' : 'Package Uploaded!') :
             isError ? (isDownload ? 'Download Blocked' : 'Upload Failed') :
             isCancelled ? (isDownload ? 'Download Cancelled' : 'Upload Cancelled') :
             (isDownload ? 'Downloading Application...' : 'Uploading Application...')}
          </h3>

          {/* File Name & Size Frosted Card */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '5px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.6rem',
            maxWidth: '100%'
          }}>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '5px',
              background: 'rgba(99, 102, 241, 0.25)',
              color: '#c7d2fe',
              border: '1px solid rgba(99, 102, 241, 0.4)'
            }}>
              APK
            </span>
            <span style={{ 
              maxWidth: '220px', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              color: '#e2e8f0',
              fontSize: '0.86rem',
              fontWeight: 600
            }}>
              {fileName}
            </span>
            {fileSize && (
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
                • {fileSize}
              </span>
            )}
          </div>

          {/* High-Tech Progress Section */}
          {(status === 'active' || isSuccess) && (
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.55rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500 }}>
                  {isSuccess ? (isDownload ? 'Download Status:' : 'Upload Status:') : 'Transfer Progress:'}
                </span>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 900, 
                  color: isSuccess ? '#34d399' : '#818cf8',
                  textShadow: isSuccess ? '0 0 12px rgba(52, 211, 153, 0.6)' : '0 0 12px rgba(129, 140, 248, 0.6)',
                  letterSpacing: '-0.02em'
                }}>
                  {progress}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div style={{
                height: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'relative'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: isSuccess 
                    ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' 
                    : 'linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #a855f7 100%)',
                  borderRadius: '10px',
                  transition: 'width 0.25s ease-out',
                  boxShadow: isSuccess 
                    ? '0 0 15px rgba(16, 185, 129, 0.7)' 
                    : '0 0 15px rgba(99, 102, 241, 0.7)'
                }} />
              </div>

              <div style={{ 
                marginTop: '0.75rem', 
                fontSize: '0.8rem', 
                color: isSuccess ? '#34d399' : '#94a3b8', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.35rem' 
              }}>
                {isSuccess ? (
                  <>
                    <CheckCircle size={13} color="#34d399" />
                    <span>{isDownload ? 'Saved to your Downloads folder!' : 'Application published successfully!'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} color="#38bdf8" />
                    <span>{isDownload ? 'In-page stream • Zero extra tabs opened' : 'High-speed encrypted cloud transfer'}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {isError && (
            <p style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.88rem', lineHeight: 1.5 }}>
              {error || (isDownload ? 'An unexpected error occurred during the download.' : 'An unexpected error occurred during the upload.')}
            </p>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {status === 'active' && (
              <button 
                onClick={onCancel} 
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
              >
                <X size={16} /> {isDownload ? 'Cancel Download' : 'Cancel Upload'}
              </button>
            )}

            {(isError || isCancelled) && (
              <>
                <button 
                  onClick={onRetry} 
                  style={{
                    flex: 1.2,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  <RotateCcw size={16} /> Retry
                </button>
                <button 
                  onClick={handleClose} 
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
              </>
            )}

            {isSuccess && (
              <button 
                onClick={handleClose} 
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)'
                }}
              >
                <CheckCircle size={16} /> Done
              </button>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProgressModal;
