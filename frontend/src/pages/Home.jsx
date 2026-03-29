import React, { useEffect, useState } from 'react';
import { Download, LayoutGrid, Database } from 'lucide-react';
import config from '../config';

const Home = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/apps`);
      const data = await response.json();
      setApps(data);
    } catch (err) {
      console.error('Error fetching apps:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id, fileUrl) => {
    try {
      await fetch(`${config.API_BASE_URL}/download/${id}`, { method: 'PUT' });
      window.open(fileUrl, '_blank');
      fetchApps(); // Update download count locally
    } catch (err) {
      console.error('Error tracking download:', err);
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '70vh' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem 0' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Explore Our Store
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px' }}>
          Discover the latest premium applications, uploaded directly to our high-speed servers.
        </p>
      </header>

      <div className="grid-apps">
        {apps.length === 0 ? (
          <div className="glass" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center' }}>
            <Database size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ color: 'var(--text-muted)' }}>No apps uploaded yet.</h3>
          </div>
        ) : (
          apps.map((app) => (
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
    </div>
  );
};

export default Home;
