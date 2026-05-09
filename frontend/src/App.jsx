import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import BottomNavbar from './components/BottomNavbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import UploadApp from './pages/UploadApp';
import './index.css';

function App() {
  console.log('CStore v1.1.0 Loaded - 2026-05-09');
  return (
    <Router>
      <div className="App">
        <Navbar />
        <main className="container">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            {/* User Protected Route */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            } />

            {/* General Upload Route (Any logged in user) */}
            <Route path="/upload" element={
              <ProtectedRoute>
                <UploadApp />
              </ProtectedRoute>
            } />

            {/* Admin Protected Route */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
          </Routes>
          {/* Bottom Spacer for Mobile */}
          <div className="mobile-only" style={{ height: '140px' }} />
        </main>
        <BottomNavbar />
      </div>
    </Router>
  );
}

export default App;
