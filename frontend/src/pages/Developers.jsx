import React, { useEffect, useState } from 'react';
import { Code2, ShieldCheck, Sparkles, ExternalLink, Github, Terminal, GitBranch, Layers } from 'lucide-react';
import { supabase } from '../supabaseClient';

const Developers = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        setLoading(true);
        const { data } = await supabase
          .from('core_team')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (data) setTeamMembers(data);
      } catch (e) {
        console.warn('Team fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  return (
    <div className="developers-page fade-in" style={{ paddingBottom: '30px' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', margin: '1rem 0 2.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '4px 14px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: '0.75rem' }}>
          <Sparkles size={14} color="#a5b4fc" className="animate-pulse" />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Open Source Builders
          </span>
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
          Core Engineering Team
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '600px', margin: '0.5rem auto 0', lineHeight: 1.6 }}>
          Meet the core architects and contributors engineering the CStore distribution engine and MSM Movin software ecosystem.
        </p>
      </div>

      {/* Grid of Team Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {loading ? (
          [1, 2, 3].map(n => (
            <div
              key={n}
              className="glass skeleton-card"
              style={{
                padding: '1.75rem',
                borderRadius: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '260px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', marginBottom: '1.25rem' }}>
                  <div className="skeleton-shimmer" style={{ width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div className="skeleton-shimmer" style={{ height: '20px', width: '65%', borderRadius: '4px' }} />
                    <div className="skeleton-shimmer" style={{ height: '14px', width: '45%', borderRadius: '4px' }} />
                    <div className="skeleton-shimmer" style={{ height: '22px', width: '100px', borderRadius: '6px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.5rem' }}>
                  <div className="skeleton-shimmer" style={{ height: '14px', width: '100%', borderRadius: '4px' }} />
                  <div className="skeleton-shimmer" style={{ height: '14px', width: '85%', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className="skeleton-shimmer" style={{ height: '26px', width: '60px', borderRadius: '6px' }} />
                <div className="skeleton-shimmer" style={{ height: '26px', width: '75px', borderRadius: '6px' }} />
                <div className="skeleton-shimmer" style={{ height: '26px', width: '65px', borderRadius: '6px' }} />
              </div>
            </div>
          ))
        ) : (
          teamMembers.map(member => (
            <div
              key={member.id}
              className="glass card-loaded-fade"
            style={{
              padding: '1.75rem',
              borderRadius: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: member.is_lead ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--glass-border)',
              background: member.is_lead ? 'linear-gradient(145deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'rgba(15, 23, 42, 0.5)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', marginBottom: '1rem' }}>
                <img
                  src={member.avatar_url || `https://github.com/${member.github_username}.png`}
                  alt={member.name}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: member.is_lead ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.1)',
                    boxShadow: member.is_lead ? '0 0 16px rgba(129, 140, 248, 0.4)' : 'none',
                  }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', margin: 0 }}>
                      {member.name}
                    </h3>
                    {member.is_lead && <ShieldCheck size={18} color="#818cf8" title="Lead Architect" />}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    @{member.github_username}
                  </span>
                  <div style={{ marginTop: '0.3rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', textTransform: 'uppercase' }}>
                      {member.role || 'Contributor'}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
                {member.bio || 'Core engineering team member.'}
              </p>

              {/* Tags */}
              {member.tags && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                  {member.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.75rem', padding: '3px 9px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', color: '#cbd5e1', fontWeight: 500 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <a
              href={member.github_url || `https://github.com/${member.github_username}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'white',
                textDecoration: 'none',
                fontSize: '0.88rem',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
            >
              <Github size={16} />
              <span>Visit GitHub Profile</span>
              <ExternalLink size={14} />
            </a>
          </div>
        )))}
      </div>
    </div>
  );
};

export default Developers;
