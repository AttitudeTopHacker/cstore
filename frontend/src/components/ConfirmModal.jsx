import React from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
}) => {
  if (!isOpen) return null;

  const icons = {
    danger: <AlertTriangle size={32} color="#ff416c" />,
    info: <Info size={32} color="#6366f1" />,
    success: <CheckCircle size={32} color="#22c55e" />,
  };

  const confirmGradients = {
    danger: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
    info: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    success: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  };

  const confirmGlows = {
    danger: 'rgba(255, 65, 108, 0.45)',
    info: 'rgba(99, 102, 241, 0.45)',
    success: 'rgba(34, 197, 94, 0.45)',
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem',
          animation: 'overlayFadeIn 0.25s ease-out',
        }}
      >
        {/* Modal Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'rgba(15, 20, 40, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '2.5rem 2rem',
            borderRadius: '24px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            animation: 'modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background:
                type === 'danger'
                  ? 'rgba(255, 65, 108, 0.12)'
                  : type === 'success'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(99, 102, 241, 0.12)',
              border:
                type === 'danger'
                  ? '2px solid rgba(255, 65, 108, 0.3)'
                  : type === 'success'
                  ? '2px solid rgba(34, 197, 94, 0.3)'
                  : '2px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}
          >
            {icons[type] || icons.danger}
          </div>

          {/* Title */}
          <h3
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#f8fafc',
              marginBottom: '0.75rem',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h3>

          {/* Message */}
          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              marginBottom: '2rem',
            }}
          >
            {message}
          </p>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
            }}
          >
            {/* Cancel Button */}
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '13px 20px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#94a3b8',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#f8fafc';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
              }}
            >
              {cancelText}
            </button>

            {/* Confirm Button */}
            <button
              onClick={onConfirm}
              style={{
                flex: 1,
                padding: '13px 20px',
                borderRadius: '14px',
                background: confirmGradients[type] || confirmGradients.danger,
                border: 'none',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: `0 4px 20px ${confirmGlows[type] || confirmGlows.danger}`,
                transition: 'all 0.25s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 8px 30px ${confirmGlows[type] || confirmGlows.danger}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 4px 20px ${confirmGlows[type] || confirmGlows.danger}`;
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.85) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
};

export default ConfirmModal;
