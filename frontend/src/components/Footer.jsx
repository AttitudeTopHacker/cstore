import React from 'react';
import { Sparkles, Code2, ShieldCheck } from 'lucide-react';

const Footer = () => {
  return (
    <footer
      style={{
        marginTop: '1.25rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        background: 'rgba(11, 19, 43, 0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '1.1rem 1.25rem',
        position: 'relative',
        zIndex: 10,
      }}
      className="site-footer"
    >
      <div
        className="container"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Left: Organization Badge & Copyright */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Shimmering Org Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            <Sparkles size={13} color="#a5b4fc" className="animate-pulse" />
            <span
              className="shimmer-text"
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              ORG: msm.movin 2022
            </span>
          </div>

          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            © 2022 – {new Date().getFullYear()} CStore. All Rights Reserved.
          </span>
        </div>

        {/* Right: Developer Credit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <Code2 size={15} color="#818cf8" />
          <span>Created & Developed by</span>
          <span
            style={{
              background: 'linear-gradient(135deg, #a5b4fc 0%, #c084fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            Mohd Salman
          </span>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
              marginLeft: '2px',
            }}
            title="Verified Developer"
          />
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        .shimmer-text {
          background: linear-gradient(
            90deg,
            #818cf8 0%,
            #e0e7ff 25%,
            #c084fc 50%,
            #38bdf8 75%,
            #818cf8 100%
          );
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shimmer 3s linear infinite;
          display: inline-block;
        }

        @media (max-width: 768px) {
          .site-footer {
            padding: 1rem 1rem calc(1rem + 70px) !important;
          }
          .site-footer .container {
            justify-content: center !important;
            text-align: center;
          }
          .site-footer .container > div {
            justify-content: center;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
