import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import AdminUpload from './pages/AdminUpload';
import './index.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin-upload" element={<AdminUpload />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
