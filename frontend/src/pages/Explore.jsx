import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  Download, Sparkles, Code2, Users, Rocket, Clock, ChevronLeft, ChevronRight,
  CheckCircle, ArrowRight, Bell, ShieldCheck, Upload, AlertCircle, FileText,
  ExternalLink, RefreshCw, Info, X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth, isAdminUser } from '../context/AuthContext';
import { DownloadManager } from '../utils/DownloadManager';
import ProgressModal from '../components/ProgressModal';
import { getAppCategory, cleanAppDescription, getCategoryBadgeStyle } from '../utils/apkMetadata';

const Explore = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, isAdmin } = useAuth();

  const [apps, setApps] = useState([]);
  const [allAppCatalog, setAllAppCatalog] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [upcomingReleases, setUpcomingReleases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Download Modal State
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'download',
    progress: 0,
    fileName: '',
    fileSize: '',
    status: 'active',
    error: '',
    url: '',
    id: ''
  });

  // Detailed Teaser Modal State
  const [selectedTeaserDetails, setSelectedTeaserDetails] = useState(null);
  const [isClosingTeaser, setIsClosingTeaser] = useState(false);

  const handleCloseTeaser = () => {
    setIsClosingTeaser(true);
    setTimeout(() => {
      setSelectedTeaserDetails(null);
      setIsClosingTeaser(false);
    }, 200);
  };

  // Carousel ref for smooth horizontal scrolling
  const carouselRef = useRef(null);

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    fetchExploreData();
  }, []);

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      const [appsRes, allAppsRes, teamRes, upcomingRes] = await Promise.all([
        supabase.from('apps').select('*').order('download_count', { ascending: false }).limit(8),
        supabase.from('apps').select('id, name'),
        supabase.from('core_team').select('*').eq('is_active', true).order('display_order', { ascending: true }),
        supabase.from('upcoming_releases').select('*').eq('is_published', false).order('created_at', { ascending: false }),
      ]);

      if (appsRes.data) setApps(appsRes.data.filter(app => !app.is_draft && app.icon_url));
      if (allAppsRes.data) setAllAppCatalog(allAppsRes.data);
      if (teamRes.data) setTeamMembers(teamRes.data);
      if (upcomingRes.data) setUpcomingReleases(upcomingRes.data);
    } catch (err) {
      console.warn('Explore data load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to reliably detect if an upcoming release is an app update
  const isAppUpdate = (item) => {
    if (!item) return false;
    if (item.is_update === true || item.is_update === 'true' || item.is_update === 1) return true;
    if (item.existing_app_id) return true;
    const cleanItemName = item.app_name?.trim().toLowerCase();
    if (cleanItemName) {
      if (allAppCatalog.some(a => a.name?.trim().toLowerCase() === cleanItemName)) return true;
      if (apps.some(a => a.name?.trim().toLowerCase() === cleanItemName)) return true;
    }
    return false;
  };

  // Instant Download Handler
  const handleDownload = async (app) => {
    const { id, file_url, name, size } = app;
    const cleanName = (name || 'app').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim();
    const cleanVersion = (app.version || '1.0').replace(/[^a-zA-Z0-9.]/g, '_');
    const fileName = `${cleanName}_v${cleanVersion}.apk`;

    setModal({
      isOpen: true,
      type: 'download',
      progress: 0,
      fileName,
      fileSize: size,
      status: 'active',
      error: '',
      url: file_url,
      id
    });

    try {
      // 1. Direct Supabase download tracking in background
      (async () => {
        try {
          await supabase.rpc('increment_download_count', { app_id: id });
          if (user?.id) {
            await supabase.from('downloads').insert([{ user_id: user.id, app_id: id }]);
          }
        } catch (_) { }
      })();

      // 2. High-speed download
      const isActuallyChunked = app.is_chunked || (app.file_url && app.file_url.includes('chunked_'));
      if (isActuallyChunked) {
        const effectiveChunkCount = app.chunk_count > 1 ? app.chunk_count : 1;
        await DownloadManager.downloadChunkedFile(file_url, effectiveChunkCount, fileName, (prog) => {
          setModal(prev => ({ ...prev, progress: prog }));
        });
      } else {
        await DownloadManager.downloadFile(file_url, fileName, (prog) => {
          setModal(prev => ({ ...prev, progress: prog }));
        });
      }

      setModal(prev => ({ ...prev, status: 'success', progress: 100 }));
      // Kept open until user explicitly clicks "Done" or "X" button
    } catch (err) {
      setModal(prev => ({ ...prev, status: 'error', error: err.message }));
    }
  };

  // Check if current user is the original creator of this upcoming release
  const canManageRelease = (item) => {
    if (!isLoggedIn || !user) return false;
    const isCreator = (user.id && item.created_by && user.id === item.created_by) ||
      (user.email && item.creator_email && user.email.toLowerCase() === item.creator_email.toLowerCase());
    return !!isCreator;
  };

  return (
    <div className="explore-page fade-in" style={{ paddingBottom: '30px' }}>

      {/* ── 1. Hero Stream Deck (Concept 2 Banner) ─────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '3px 10px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: '0.5rem' }}>
              <Sparkles size={13} color="#a5b4fc" className="animate-pulse" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Linear Stream Deck
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, margin: 0, color: 'white', letterSpacing: '-0.02em' }}>
              Explore Applications
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
              Swipeable verified applications directly hosted on Supabase high-speed storage.
            </p>
          </div>

          {/* Carousel Arrow Controls */}
          <div className="desktop-only" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => scrollCarousel('left')}
              aria-label="Previous Apps"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              aria-label="Next Apps"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Horizontal Swipeable Stream Rail */}
        <div
          ref={carouselRef}
          className="scroll-touch-x"
          style={{
            display: 'flex',
            gap: '1.25rem',
            overflowX: 'auto',
            paddingBottom: '0.75rem',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {loading ? (
            [1, 2, 3, 4, 5].map(n => (
              <div
                key={n}
                className="glass skeleton-card"
                style={{
                  minWidth: '280px',
                  maxWidth: '300px',
                  flex: '0 0 auto',
                  padding: '1.1rem 1.25rem',
                  borderRadius: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '185px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.75rem' }}>
                    <div className="skeleton-shimmer" style={{ width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div className="skeleton-shimmer" style={{ height: '16px', width: '75%', borderRadius: '4px' }} />
                      <div className="skeleton-shimmer" style={{ height: '12px', width: '45%', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    <div className="skeleton-shimmer" style={{ height: '12px', width: '100%', borderRadius: '3px' }} />
                    <div className="skeleton-shimmer" style={{ height: '12px', width: '70%', borderRadius: '3px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="skeleton-shimmer" style={{ height: '14px', width: '45px', borderRadius: '4px' }} />
                  <div className="skeleton-shimmer" style={{ height: '34px', width: '92px', borderRadius: '10px' }} />
                </div>
              </div>
            ))
          ) : (
            apps.map((app, index) => (
              <div
                key={app.id}
                className="glass card-loaded-fade"
                style={{
                  minWidth: '280px',
                  maxWidth: '300px',
                  flex: '0 0 auto',
                  padding: '1.1rem 1.25rem',
                  borderRadius: '18px',
                  scrollSnapAlign: 'start',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: index === 0 ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--glass-border)',
                  background: index === 0 ? 'linear-gradient(145deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'rgba(15, 23, 42, 0.6)',
                  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(99, 102, 241, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  {/* Header: Icon + Name + Version Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.65rem' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {app.icon_url ? (
                        <img src={app.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#a5b4fc' }}>
                          {app.name.charAt(0)}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.name}
                        </h3>
                        {(() => {
                          const cat = getAppCategory(app);
                          const style = getCategoryBadgeStyle(cat);
                          return (
                            <span style={{
                              fontSize: '0.62rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: style.bg,
                              border: `1px solid ${style.border}`,
                              color: style.color,
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              {cat}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                          {app.version || 'v1.0'}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {app.size || 'APK'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4, margin: '0 0 0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cleanAppDescription(app.description) || 'Verified fast Android package on CStore.'}
                  </p>

                  {/* Active Update Teaser Badge or Admin Update Badge on App Card */}
                  {app.updated_by_admin && (
                    <div style={{ marginTop: '0.2rem', padding: '2px 8px', borderRadius: '5px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#fbbf24' }}>
                        ⚡ Admin by Update
                      </span>
                    </div>
                  )}
                  {(() => {
                    const upcomingUpdate = upcomingReleases.find(u => u.is_update && u.existing_app_id === app.id);
                    if (upcomingUpdate) {
                      return (
                        <div style={{ marginTop: '0.2rem', padding: '2px 8px', borderRadius: '5px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#fbbf24' }}>
                            ⚡ Update {upcomingUpdate.version} in Dev ({upcomingUpdate.progress}%)
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Bottom Card Controls: Download Count + Get APK Button */}
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                    <span style={{ color: '#818cf8', fontWeight: 700 }}>{app.download_count || 0}</span> dls
                  </span>

                  <button
                    onClick={() => handleDownload(app)}
                    className="btn-primary"
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.78rem',
                      borderRadius: '7px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 700,
                    }}
                  >
                    <Download size={13} /> Get APK
                  </button>
                </div>
              </div>
            )))}

          {/* "View Full Catalog" Card at end of stream */}
          <Link
            to="/apps"
            className="glass"
            style={{
              minWidth: '200px',
              flex: '0 0 auto',
              padding: '1.25rem',
              borderRadius: '18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              textAlign: 'center',
              border: '2px dashed rgba(99, 102, 241, 0.3)',
              background: 'rgba(99, 102, 241, 0.04)',
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.6rem', color: '#a5b4fc' }}>
              <ArrowRight size={18} />
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>View All Apps</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>Full 8-app catalog</span>
          </Link>
        </div>
      </section>

      {/* ── 2. Core Team & GitHub Profiles Showcase ────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Code2 size={20} color="#818cf8" /> Core Engineering Team
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
              Verified architects and open-source contributors behind MSM Movin & CStore.
            </p>
          </div>

          <Link to="/developers" style={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
            Meet The Team &rarr;
          </Link>
        </div>

        {/* Compact Core Team Cards (Height ends right at Role Badge) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
          {loading ? (
            [1, 2].map(n => (
              <div
                key={n}
                className="glass skeleton-card"
                style={{
                  padding: '0.9rem 1.25rem',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  minHeight: '74px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="skeleton-shimmer" style={{ height: '16px', width: '55%', borderRadius: '4px' }} />
                    <div className="skeleton-shimmer" style={{ height: '12px', width: '35%', borderRadius: '4px' }} />
                  </div>
                </div>
                <div className="skeleton-shimmer" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
              </div>
            ))
          ) : (
            teamMembers.map(member => (
              <div
                key={member.id}
                className="glass card-loaded-fade"
                style={{
                  padding: '0.9rem 1.25rem',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  border: member.is_lead ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--glass-border)',
                  background: member.is_lead ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'rgba(15, 23, 42, 0.5)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: 0 }}>
                  <img
                    src={member.avatar_url || `https://github.com/${member.github_username}.png`}
                    alt={member.name}
                    referrerPolicy="no-referrer"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: member.is_lead ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.1)',
                      boxShadow: member.is_lead ? '0 0 12px rgba(129, 140, 248, 0.4)' : 'none',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0 }}>
                        {member.name}
                      </h3>
                      {member.is_lead && <ShieldCheck size={15} color="#818cf8" title="Lead Architect" />}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginTop: '1px' }}>
                      @{member.github_username}
                    </span>
                    <div style={{ marginTop: '0.2rem' }}>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '5px',
                        background: 'rgba(99, 102, 241, 0.18)',
                        color: '#a5b4fc',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        display: 'inline-block'
                      }}>
                        {member.role || 'Contributor'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arrow Button on Right */}
                <a
                  href={member.github_url || `https://github.com/${member.github_username}`}
                  target="_blank"
                  rel="noreferrer"
                  title="View GitHub Profile"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <ChevronRight size={18} />
                </a>
              </div>
            )))}
        </div>
      </section>

      {/* ── 3. Upcoming Releases (Coming Soon Pipeline) ────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Rocket size={20} color="#c084fc" /> Upcoming Releases Pipeline
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
              Preview next-generation apps in active development. Only creators can upload & publish.
            </p>
          </div>
        </div>

        {/* Compact Coming Soon Cards (Exact matching compact height) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
          {loading ? (
            [1, 2].map(n => (
              <div
                key={n}
                className="glass skeleton-card"
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  minHeight: '74px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ width: '46px', height: '46px', borderRadius: '12px', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="skeleton-shimmer" style={{ height: '16px', width: '50%', borderRadius: '4px' }} />
                    <div className="skeleton-shimmer" style={{ height: '12px', width: '35%', borderRadius: '4px' }} />
                  </div>
                </div>
                <div className="skeleton-shimmer" style={{ width: '68px', height: '32px', borderRadius: '8px', flexShrink: 0 }} />
              </div>
            ))
          ) : (
            upcomingReleases.map(rel => {
              const isUpdate = isAppUpdate(rel);

              return (
                <div
                  key={rel.id}
                  className="glass card-loaded-fade"
                  style={{
                    position: 'relative',
                    padding: '1rem 1.25rem 0.9rem',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                    border: isUpdate ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(192, 132, 252, 0.25)',
                    background: isUpdate
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.8) 100%)'
                      : 'linear-gradient(135deg, rgba(192, 132, 252, 0.06) 0%, rgba(15, 23, 42, 0.8) 100%)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* 1. Top-Right Corner Status Text (1px top, tiny font, unbolded, green) */}
                  <div style={{ position: 'absolute', top: '1px', right: '8px', lineHeight: 1 }}>
                    <span style={{
                      fontSize: '0.50rem',
                      fontWeight: 500,
                      color: '#10b981',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      lineHeight: 1,
                      userSelect: 'none'
                    }}>
                      {isUpdate ? 'Update Soon' : 'Coming Soon'}
                    </span>
                  </div>

                  {/* 2. Left: Icon + Titles + Progress Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1, paddingRight: '0.4rem' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: isUpdate ? 'rgba(245, 158, 11, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                      border: isUpdate ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(192, 132, 252, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                      overflow: 'hidden'
                    }}>
                      {rel.icon_url ? (
                        <img src={rel.icon_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }} />
                      ) : isUpdate ? '🔄' : '🚀'}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
                        <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                          {rel.app_name}
                        </h3>
                        <span style={{ fontSize: '0.7rem', color: isUpdate ? '#fbbf24' : '#a855f7', fontWeight: 700, flexShrink: 0 }}>
                          {isUpdate ? `Update ${rel.version}` : rel.version || 'v1.0'}
                        </span>
                        {(() => {
                          const cat = getAppCategory(rel);
                          const style = getCategoryBadgeStyle(cat);
                          return (
                            <span style={{
                              fontSize: '0.62rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: style.bg,
                              border: `1px solid ${style.border}`,
                              color: style.color,
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              {cat}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Progress Bar & Milestone */}
                      <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
                        <div style={{ width: '85px', height: '5px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${rel.progress || 50}%`,
                              background: isUpdate ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)' : 'linear-gradient(90deg, #818cf8 0%, #c084fc 100%)',
                              borderRadius: '6px',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: isUpdate ? '#fbbf24' : '#c084fc', fontWeight: 700, flexShrink: 0 }}>
                          {rel.progress || 50}%
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          • {isUpdate ? 'Update Soon' : (rel.estimated_release || 'Coming Soon')}
                        </span>
                      </div>
                    </div>
                  </div>

                {/* 3. Right: Arrow Button */}
                <button
                  type="button"
                  onClick={() => setSelectedTeaserDetails(rel)}
                  title="View Details"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            );
          }))}
        </div>
      </section>

      {/* ── 4. Detailed Coming Soon Teaser Modal ────────────────────────────── */}
      {selectedTeaserDetails && (() => {
        const isModalUpdate = isAppUpdate(selectedTeaserDetails);
        return createPortal(
          <div
            className={isClosingTeaser ? 'modal-backdrop-out' : 'modal-backdrop-in'}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(2, 6, 23, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '1.25rem'
            }}
            onClick={handleCloseTeaser}
          >
            <div
              className={isClosingTeaser ? 'modal-card-out' : 'modal-card-in'}
              style={{
                width: '100%',
                maxWidth: '540px',
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: '2rem',
                borderRadius: '24px',
                border: '1px solid rgba(192, 132, 252, 0.35)',
                background: '#0b132b',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(168, 85, 247, 0.25)',
                position: 'relative'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header: Icon + Titles + Close Button */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: isModalUpdate ? 'rgba(245, 158, 11, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                    border: isModalUpdate ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(192, 132, 252, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {selectedTeaserDetails.icon_url ? (
                      <img src={selectedTeaserDetails.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : isModalUpdate ? '🔄' : '🚀'}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white', margin: 0 }}>
                        {selectedTeaserDetails.app_name}
                      </h3>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isModalUpdate ? 'rgba(245, 158, 11, 0.2)' : 'rgba(192, 132, 252, 0.2)',
                        color: isModalUpdate ? '#fde68a' : '#e9d5ff',
                        border: isModalUpdate ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(192, 132, 252, 0.35)',
                        textTransform: 'uppercase'
                      }}>
                        {isModalUpdate ? 'Version Update' : 'New Release'}
                      </span>
                      {(() => {
                        const cat = getAppCategory(selectedTeaserDetails);
                        const style = getCategoryBadgeStyle(cat);
                        return (
                          <span style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: style.bg,
                            border: `1px solid ${style.border}`,
                            color: style.color
                          }}>
                            {cat}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#a5b4fc', marginTop: '0.2rem', fontWeight: 600 }}>
                      Target Version: <span style={{ color: 'white' }}>{selectedTeaserDetails.version || 'v1.0.0'}</span> • Estimated: <span style={{ color: 'white' }}>{isModalUpdate ? 'Update Soon' : (selectedTeaserDetails.estimated_release || 'Coming Soon')}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCloseTeaser}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tagline Highlight Banner */}
              {selectedTeaserDetails.tagline && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  color: '#e0e7ff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Sparkles size={16} color="#a5b4fc" style={{ flexShrink: 0 }} />
                  <span>{selectedTeaserDetails.tagline}</span>
                </div>
              )}

              {/* Progress Milestone Bar */}
              <div style={{ marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.9rem 1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Development Milestone:</span>
                  <span style={{ fontWeight: 800, color: isModalUpdate ? '#fbbf24' : '#c084fc' }}>
                    {selectedTeaserDetails.progress || 50}% Completed
                  </span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${selectedTeaserDetails.progress || 50}%`,
                      background: isModalUpdate ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)' : 'linear-gradient(90deg, #818cf8 0%, #c084fc 100%)',
                      borderRadius: '6px'
                    }}
                  />
                </div>
              </div>

              {/* Full Detailed Description Section */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={15} color="#a5b4fc" /> Full Description & Features
                </h4>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1rem',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  color: '#e2e8f0',
                  fontSize: '0.88rem',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap'
                }}>
                  {cleanAppDescription(selectedTeaserDetails.description) || selectedTeaserDetails.tagline || 'No extended description provided yet. Check back soon!'}
                </div>
              </div>

              {/* Metadata Footer: Creator info + GitHub repo */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}>
                <div>
                  <span>Architect: </span>
                  <strong style={{ color: 'white' }}>{selectedTeaserDetails.creator_name || selectedTeaserDetails.creator_email || 'Verified Creator'}</strong>
                </div>

                {selectedTeaserDetails.github_repo_url && (
                  <a
                    href={selectedTeaserDetails.github_repo_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontWeight: 600 }}
                  >
                    <ExternalLink size={13} /> View GitHub Source
                  </a>
                )}
              </div>

              {/* Action Bar */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleCloseTeaser}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  Close
                </button>

                {canManageRelease(selectedTeaserDetails) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseTeaser();
                      setTimeout(() => navigate('/dashboard'), 210);
                    }}
                    className="btn-primary"
                    style={{
                      flex: 1.5,
                      padding: '11px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Upload size={14} /> Go to Dashboard to Upload
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
      {/* Download Progress Modal */}
      <ProgressModal
        {...modal}
        onCancel={() => setModal({ ...modal, status: 'cancelled' })}
        onRetry={() => handleDownload(apps.find(a => a.id === modal.id))}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
};

export default Explore;
