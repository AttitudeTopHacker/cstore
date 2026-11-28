import React, { useEffect, useState } from 'react';
import { Download, LayoutGrid, Search, PackageOpen, LogIn, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VersionHistoryModal from '../components/VersionHistoryModal';
import AppDetailsModal from '../components/AppDetailsModal';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ProgressModal from '../components/ProgressModal';
import { DownloadManager } from '../utils/DownloadManager';
import { getAppCategory, cleanAppDescription, getCategoryBadgeStyle } from '../utils/apkMetadata';

const isNative = Capacitor.getPlatform() !== 'web';

// Isolated Memoized Typewriter to prevent whole page re-renders on every character
const HeroTypewriterHeadline = React.memo(() => {
  const heroPhrases = [
    'Premium App Ecosystem',
    'ORG: MSM.MOVIN'
  ];
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = heroPhrases[phraseIndex];
    let timer;

    if (!isDeleting) {
      if (displayedText.length < currentPhrase.length) {
        timer = setTimeout(() => {
          setDisplayedText(currentPhrase.substring(0, displayedText.length + 1));
        }, 80);
      } else {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 3500);
      }
    } else {
      if (displayedText.length > 0) {
        timer = setTimeout(() => {
          setDisplayedText(currentPhrase.substring(0, displayedText.length - 1));
        }, 40);
      } else {
        timer = setTimeout(() => {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % heroPhrases.length);
        }, 300);
      }
    }

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, phraseIndex]);

  return (
    <h1 className="hero-headline-wrapper">
      <span className={phraseIndex === 0 ? "hero-title-main" : "hero-title-sub"}>
        {displayedText}
      </span>
      <span 
        style={{ 
          display: 'inline-block',
          width: '3.5px',
          height: phraseIndex === 0 ? 'clamp(1.8rem, 4.5vw, 2.8rem)' : 'clamp(1.15rem, 2.8vw, 1.65rem)',
          marginLeft: '6px',
          background: 'linear-gradient(180deg, #818cf8 0%, #c084fc 100%)',
          borderRadius: '2px',
          boxShadow: '0 0 10px rgba(129, 140, 248, 0.8)',
          animation: 'typewriterBlink 0.9s step-start infinite',
          verticalAlign: 'middle',
          transition: 'height 0.2s ease'
        }} 
      />
    </h1>
  );
});

const Home = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { user, token, isLoggedIn } = useAuth();
  
  // Progress Modal State
  const [modal, setModal] = useState({ isOpen: false, type: 'download', progress: 0, fileName: '', fileSize: '', status: 'active', error: '', url: '', id: '' });
  
  // Track downloaded apps — only used on Android
  const [downloadedApps, setDownloadedApps] = useState({});

  // Version History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedAppForHistory, setSelectedAppForHistory] = useState(null);

  // App Details Modal State
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedAppForDetails, setSelectedAppForDetails] = useState(null);

  // On Android: scan Download/cstore folder on load to check existing APKs
  useEffect(() => {
    if (!isNative) return;

    const checkDownloadedFiles = async () => {
      try {
        const result = await Filesystem.readdir({
          path: 'Download/cstore',
          directory: Directory.ExternalStorage,
        });

        const fileNames = result.files.map(f => (typeof f === 'string' ? f : f.name));

        setApps(prev => {
          const newDownloaded = {};
          prev.forEach(app => {
            const cleanName = (app.name || 'app').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
            const cleanVersion = (app.version || '1.0').replace(/[^a-zA-Z0-9.]/g, '_');
            const expectedFileName = `${cleanName}_v${cleanVersion}.apk`;
            if (fileNames.includes(expectedFileName)) {
              newDownloaded[app.id] = `Download/cstore/${expectedFileName}`;
            }
          });
          setDownloadedApps(newDownloaded);
          return prev;
        });
      } catch (e) {
        // Folder doesn't exist yet — that's fine
      }
    };

    if (apps.length > 0) {
      checkDownloadedFiles();
    }
  }, [apps]);

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const queryPromise = supabase
        .from('apps')
        .select('*')
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase request timeout')), 6000)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) throw error;
      setApps((data || []).filter(app => !app.is_draft && app.icon_url));
    } catch (err) {
      console.warn('Supabase apps load notice:', err.message);
      // Keep any already loaded apps or empty array
      setApps(prev => (prev.length > 0 ? prev : []));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (app) => {
    const { id, file_url, name, size } = app;
    const cleanName = (name || 'app').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim();
    const cleanVersion = (app.version || '1.0').replace(/[^a-zA-Z0-9.]/g, '_');
    const fileName = `${cleanName}_v${cleanVersion}.apk`;

    setModal({
      isOpen: true,
      type: 'download',
      progress: 0,
      fileName: fileName,
      fileSize: size,
      status: 'active',
      error: '',
      url: file_url,
      id: id
    });

    try {
      // 1. Direct Supabase download tracking
      (async () => {
        try {
          await supabase.rpc('increment_download_count', { app_id: id });
          if (user?.id) {
            await supabase.from('downloads').insert([{ user_id: user.id, app_id: id }]);
          }
        } catch (rpcErr) {
          console.warn('Direct Supabase tracking fallback:', rpcErr);
        }
      })();

      // 2. Download file
      let path;
      const isActuallyChunked = app.is_chunked || (app.file_url && app.file_url.includes('chunked_'));
      
      if (isActuallyChunked) {
        const effectiveChunkCount = app.chunk_count > 1 ? app.chunk_count : 1; 
        path = await DownloadManager.downloadChunkedFile(file_url, effectiveChunkCount, fileName, (prog) => {
          setModal(prev => ({ ...prev, progress: prog }));
        });
      } else {
        path = await DownloadManager.downloadFile(file_url, fileName, (prog) => {
          setModal(prev => ({ ...prev, progress: prog }));
        });
      }

      // 3. Success state
      setModal(prev => ({ ...prev, status: 'success', progress: 100 }));

      if (isNative) {
        // Android: save path, show "Open App" button later
        setDownloadedApps(prev => ({ ...prev, [id]: path }));
      }
      // Kept open until user explicitly clicks "Done" or "X" button

    } catch (err) {
      console.error('Download failed:', err);
      
      if (err.message === 'DOWNLOAD_BLOCKED') {
        setModal(prev => ({ 
          ...prev, 
          status: 'error', 
          error: 'Google Drive is asking for a virus scan confirmation. Opening in browser so you can click "Download anyway".' 
        }));
        setTimeout(async () => {
          try {
            await Browser.open({ url: DownloadManager.getDirectLink(file_url) });
          } catch (_) {
            try {
              window.open(DownloadManager.getDirectLink(file_url), '_system');
            } catch (__) {
              window.location.href = DownloadManager.getDirectLink(file_url);
            }
          }
          setModal(prev => ({ ...prev, isOpen: false }));
        }, 3000);
      } else {
        setModal(prev => ({ ...prev, status: 'error', error: err.message }));
      }
    }
  };

  const handleOpenApp = async (id) => {
    const path = downloadedApps[id];
    if (path) {
      try {
        await DownloadManager.installApk(path);
      } catch (err) {
        console.error('Manual install failed:', err);
      }
    }
  };

  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredApps = apps.filter(app => {
    const cat = getAppCategory(app);
    const matchesCategory = selectedCategory === 'All' || cat.toLowerCase() === selectedCategory.toLowerCase();
    const query = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      app.name.toLowerCase().includes(query) || 
      (app.description && app.description.toLowerCase().includes(query)) ||
      cat.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fade-in" style={{ paddingBottom: '20px' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: 'clamp(1.25rem, 4vw, 2.5rem) 0 clamp(1rem, 3vw, 2rem)' }}>
        <HeroTypewriterHeadline />
        <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.88rem, 2.8vw, 1.05rem)', maxWidth: '650px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
          Discover and install high-performance Android applications with seamless updates and zero-latency downloads.
        </p>
        
        <div className="glass" style={{ maxWidth: '580px', margin: '0 auto', padding: '0.75rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 16px 40px rgba(0,0,0,0.3)' }}>
          <Search size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <input 
              type="text" 
              placeholder="Search apps, utilities, or games..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: 'white', fontSize: 'clamp(0.88rem, 2.5vw, 1rem)', width: '100%', fontWeight: 500 }} 
          />
        </div>
      </section>

      {/* Featured Apps Section */}
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.85rem' }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.75rem)', display: 'flex', alignItems: 'center', gap: '0.65rem', margin: 0 }}>
            <LayoutGrid size={22} style={{ color: 'var(--primary)' }} /> Trending Now
          </h2>
          <div className="scroll-touch-x" style={{ gap: '0.45rem', paddingBottom: '4px', maxWidth: '100%' }}>
            {['All', 'Tools', 'Finance & Business', 'Productivity', 'Social & Communication'].map(cat => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '5px 13px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                    background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    color: isSelected ? '#a5b4fc' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid-apps">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div 
                key={n} 
                className="glass skeleton-card app-card" 
                style={{ 
                  padding: 'clamp(1.15rem, 3.5vw, 2rem)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minHeight: '260px',
                  borderRadius: '24px'
                }}
              >
                <div style={{ display: 'flex', gap: 'clamp(0.85rem, 2.5vw, 1.5rem)', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div className="skeleton-shimmer" style={{ width: 'clamp(54px, 14vw, 72px)', height: 'clamp(54px, 14vw, 72px)', borderRadius: '16px', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="skeleton-shimmer" style={{ height: '20px', width: '70%', borderRadius: '6px' }} />
                    <div className="skeleton-shimmer" style={{ height: '14px', width: '40%', borderRadius: '4px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: '14px', width: '100%', borderRadius: '4px' }} />
                  <div className="skeleton-shimmer" style={{ height: '14px', width: '90%', borderRadius: '4px' }} />
                  <div className="skeleton-shimmer" style={{ height: '14px', width: '65%', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div className="skeleton-shimmer" style={{ height: '18px', width: '55px', borderRadius: '4px' }} />
                  <div className="skeleton-shimmer" style={{ height: '40px', width: '120px', borderRadius: '12px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="glass" style={{ padding: '4rem 1.5rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <PackageOpen size={56} style={{ color: 'var(--primary)', opacity: 0.4, marginBottom: '1.5rem' }} />
            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.75rem' }}>Vault is Empty</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>Be the pioneer. Upload the first application to our growing ecosystem.</p>
            <button onClick={() => navigate(user ? '/upload' : '/login')} className="btn-primary">Get Started</button>
          </div>
        ) : (
          <div className="grid-apps">
            {filteredApps.map((app) => (
              <div key={app.id} className="glass card-loaded-fade app-card" style={{ padding: 'clamp(1.15rem, 3.5vw, 2rem)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 'clamp(0.85rem, 2.5vw, 1.5rem)', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ 
                    width: 'clamp(54px, 14vw, 72px)', height: 'clamp(54px, 14vw, 72px)', borderRadius: 'clamp(14px, 3.5vw, 20px)', 
                    background: 'rgba(255,255,255,0.03)', overflow: 'hidden',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                    flexShrink: 0
                  }}>
                      {app.icon_url ? <img src={app.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LayoutGrid size={28} style={{ margin: '14px', opacity: 0.5 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: 'clamp(1.15rem, 3.5vw, 1.4rem)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</h3>
                      {(() => {
                        const cat = getAppCategory(app);
                        const style = getCategoryBadgeStyle(cat);
                        return (
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            background: style.bg,
                            border: `1px solid ${style.border}`,
                            color: style.color,
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            whiteSpace: 'nowrap'
                          }}>
                            {cat}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span 
                        onClick={() => { setSelectedAppForHistory(app); setIsHistoryOpen(true); }}
                        style={{ 
                          fontSize: '0.82rem', 
                          color: 'var(--primary)', 
                          fontWeight: 700, 
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          textDecoration: 'underline'
                        }}
                        title="Click to view version history"
                      >
                        <Clock size={12} /> {app.version}
                      </span>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--glass-border)' }} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{app.size}</span>
                    </div>
                  </div>
                </div>
                
                {/* Description */}
                <div style={{ marginBottom: 'clamp(1.2rem, 3vw, 2.5rem)', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                  <p 
                    style={{ 
                      color: 'var(--text-muted)', 
                      fontSize: '0.95rem', 
                      lineHeight: 1.6,
                      margin: 0,
                      height: '4.5rem', 
                      overflow: 'hidden', 
                      display: '-webkit-box', 
                      WebkitLineClamp: 3, 
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {cleanAppDescription(app.description) || 'Elevate your experience with this premium utility designed for modern Android devices.'}
                  </p>
                  {app.description && app.description.length > 120 && (
                    <button 
                      onClick={() => { setSelectedAppForDetails(app); setIsDetailsOpen(true); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '2px 0 0',
                        alignSelf: 'flex-start',
                        fontFamily: 'inherit',
                        textDecoration: 'underline',
                        opacity: 0.9,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.9}
                    >
                      More Detailed Description
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Download size={16} /> {app.download_count}
                    </span>
                  </div>

                  {/* Button Logic:
                      - Web: always show "Download" 
                      - Android: show "Open App" if already downloaded, else "Install Now" */}
                  {isNative && downloadedApps[app.id] ? (
                    <button onClick={() => handleOpenApp(app.id)} className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)' }}>
                      Open App
                    </button>
                  ) : (
                    <button onClick={() => handleDownload(app)} className="btn-primary">
                      {isNative ? 'Install Now' : 'Download'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProgressModal 
        {...modal}
        onCancel={() => setModal({ ...modal, status: 'cancelled' })}
        onRetry={() => handleDownload(apps.find(a => a.id === modal.id))}
        onClose={() => {
          if (isNative && modal.status === 'success' && downloadedApps[modal.id]) {
            try { DownloadManager.installApk(downloadedApps[modal.id]); } catch (e) {}
          }
          setModal(prev => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        app={selectedAppForHistory}
        onDownloadOld={(record) => {
          setIsHistoryOpen(false);
          handleDownload({
            id: record.app_id,
            name: `${selectedAppForHistory.name} (${record.version})`,
            file_url: record.file_url,
            size: record.size,
            version: record.version,
            is_chunked: false,
            chunk_count: 1
          });
        }}
      />

      {/* App Details Modal */}
      <AppDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        app={selectedAppForDetails}
        onDownload={handleDownload}
      />
    </div>
  );
};

export default Home;
