import React from 'react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", type = "danger" }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="confirm-modal glass animate-fade-in">
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button 
            className={`btn-primary ${type === 'danger' ? 'btn-danger' : ''}`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }

        .confirm-modal {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 2rem;
          border-radius: 20px;
          max-width: 400px;
          width: 90%;
          text-align: center;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }

        .modal-title {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: white;
          font-weight: 700;
        }

        .modal-message {
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 2rem;
          line-height: 1.5;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-danger {
          background: linear-gradient(135deg, #ff416c, #ff4b2b) !important;
          border: none !important;
        }

        .btn-danger:hover {
          box-shadow: 0 0 20px rgba(255, 65, 108, 0.4) !important;
        }

        .animate-fade-in {
          animation: modalAppear 0.3s ease-out;
        }

        @keyframes modalAppear {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ConfirmModal;
