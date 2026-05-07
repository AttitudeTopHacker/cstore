const config = {
    // Force Render backend on Android/iOS Capacitor and Production Web
    API_BASE_URL: (window.location.hostname === 'localhost' && window.location.port === '5173')
        ? 'http://localhost:5000/api'
        : 'https://cstore-backend.onrender.com/api'
};

export default config;
