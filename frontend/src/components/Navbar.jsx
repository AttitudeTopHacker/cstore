import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, UploadCloud } from 'lucide-react';

const Navbar = () => {
  return (
    <nav>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          CStore <span style={{ fontWeight: 300, fontSize: '0.9rem', color: '#94a3b8' }}>PREMIUM</span>
        </Link>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link to="/" className="flex-center" style={{ color: '#f8fafc', textDecoration: 'none', gap: '0.5rem', fontSize: '0.95rem' }}>
            <LayoutGrid size={18} /> Store
          </Link>
          <Link to="/admin-upload" className="flex-center" style={{ color: '#f8fafc', textDecoration: 'none', gap: '0.5rem', fontSize: '0.95rem' }}>
            <UploadCloud size={18} /> Upload
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
