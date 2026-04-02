import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Upload, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BottomNavbar = () => {
  const { isLoggedIn, isAdmin } = useAuth();

  return (
    <div className="bottom-nav mobile-only">
      <NavLink 
        to="/" 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <LayoutGrid size={24} />
        <span>Store</span>
      </NavLink>

      <NavLink 
        to={isLoggedIn ? "/upload" : "/login"} 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <Upload size={24} />
        <span>Upload</span>
      </NavLink>

      {isLoggedIn && (
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <User size={24} />
          <span>Profile</span>
        </NavLink>
      )}

      {isAdmin && (
        <NavLink 
          to="/admin" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <ShieldCheck size={24} />
          <span>Admin</span>
        </NavLink>
      )}
    </div>
  );
};

export default BottomNavbar;
