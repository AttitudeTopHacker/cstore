import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, LayoutGrid, Users, BookOpen, Upload, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BottomNavbar = () => {
  const { isLoggedIn, isAdmin } = useAuth();

  return (
    <div className="bottom-nav mobile-only">
      <NavLink 
        to="/" 
        end
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <Compass size={22} />
        <span>Explore</span>
      </NavLink>

      <NavLink 
        to="/apps" 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <LayoutGrid size={22} />
        <span>Apps</span>
      </NavLink>

      <NavLink 
        to="/developers" 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <Users size={22} />
        <span>Teams</span>
      </NavLink>

      {isLoggedIn ? (
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <User size={22} />
          <span>Profile</span>
        </NavLink>
      ) : (
        <NavLink 
          to="/login" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <User size={22} />
          <span>Sign In</span>
        </NavLink>
      )}
    </div>
  );
};

export default BottomNavbar;
