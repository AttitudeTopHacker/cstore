import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import BottomNavbar from './components/BottomNavbar';
import Footer from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import Explore from './pages/Explore';
import Home from './pages/Home';
import Developers from './pages/Developers';
import Docs from './pages/Docs';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import UploadApp from './pages/UploadApp';
import './index.css';

function App() {
  console.log('CStore Loaded - Direct Supabase Architecture');
  return (
    <Router>
      <div className="App" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main className="container" style={{ flex: '1 0 auto', width: '100%', paddingTop: 'calc(68px + var(--sat, 0px))' }}>
          <Routes>
            {/* Concept 2 Explore Flagship Page */}
            <Route path="/" element={<Explore />} />

            {/* Full 8-App Catalog */}
            <Route path="/apps" element={<Home />} />

            {/* Developers / Team Showcase */}
            <Route path="/developers" element={<Developers />} />
            <Route path="/teams" element={<Developers />} />

            {/* Documentation & GitHub CI/CD Guides */}
            <Route path="/docs" element={<Docs />} />

            {/* Auth */}
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
        </main>
        <Footer />
        <BottomNavbar />
      </div>
    </Router>
  );
}

export default App;
