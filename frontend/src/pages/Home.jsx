import React, { useEffect, useState } from 'react';
import { Download, LayoutGrid, Database, Search, Plus, PackageOpen, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import config from '../config';

const Home = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchApps();
  }, []);

  const getDirectDownloadUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      // Handle /file/d/ID/view format
      const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
      // Handle ?id=ID format
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
      }
    }
    return url; // Return original if not Google Drive or not matching
  };

  const fetchApps = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/apps`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setApps(data);
      } else {
        setApps([]);
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id, fileUrl) => {
    try {
      await fetch(`${config.API_BASE_URL}/download/${id}`, { method: 'PUT' });
      const directUrl = getDirectDownloadUrl(fileUrl);
      window.open(directUrl, '_blank');
      fetchApps();
    } catch (err) {
      console.error('Error tracking download:', err);
    }
  };

  const handleUploadClick = () => {
    if (user) {
      navigate('/upload');
    } else {
      navigate('/login');
    }
  };

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (app.description && app.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading apps...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem 0' }}>
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Explore Our Store
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px' }}>
            Discover the latest premium applications, uploaded directly to our high-speed servers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={handleUploadClick} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '12px 24px' }}>
                {user ? <><Plus size={18} /> Upload App</> : <><LogIn size={18} /> Sign in to Upload</>}
            </button>
        </div>
      </header>

      {/* Search Bar - only show if there are apps */}
      {apps.length > 0 && (
        <div className="glass" style={{ marginBottom: '3rem', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Search size={20} style={{ color: 'var(--text-muted)' }} />
          <input 
              type="text" 
              placeholder="Search for applications..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                  background: 'none', 
                  border: 'none', 
                  outline: 'none', 
                  color: 'white', 
                  fontSize: '1.1rem', 
                  width: '100%',
                  fontFamily: 'inherit'
              }} 
          />
        </div>
      )}

      {/* App Grid or Empty State */}
      {apps.length === 0 ? (
        /* Empty State - No apps at all */
        <div className="glass" style={{ padding: '5rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ 
            width: '100px', height: '100px', borderRadius: '50%', 
            background: 'rgba(99, 102, 241, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 2rem',
            border: '2px dashed rgba(99, 102, 241, 0.3)'
          }}>
            <PackageOpen size={44} style={{ color: '#6366f1', opacity: 0.7 }} />
          </div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>No Apps Yet</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            The store is empty right now. Be the first one to upload an amazing app!
          </p>
          <button onClick={handleUploadClick} className="btn-primary" style={{ padding: '14px 32px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
            {user ? <><Plus size={18} /> Upload First App</> : <><LogIn size={18} /> Sign in to Upload</>}
          </button>
        </div>
      ) : (
        <div className="grid-apps">
          {filteredApps.length === 0 ? (
            <div className="glass" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center' }}>
              <Search size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <h3 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No results found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No apps matching "<strong>{searchTerm}</strong>". Try a different search term.</p>
            </div>
          ) : (
            filteredApps.map((app) => (
              <div key={app.id} className="glass" style={{ padding: '1.5rem', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                      {app.icon_url ? <img src={app.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LayoutGrid size={32} style={{ margin: '16px' }} />}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem' }}>{app.name}</h3>
                    <span style={{ fontSize: '0.85rem', color: '#6366f1', fontWeight: 600 }}>{app.version}</span>
                  </div>
                </div>
                
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', height: '3.6rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {app.description || 'No description provided for this application.'}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Download size={14} /> {app.download_count}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Database size={14} /> {app.size}
                      </span>
                  </div>
                  <button onClick={() => handleDownload(app.id, app.file_url)} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
                      Install Now
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
