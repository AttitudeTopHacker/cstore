const config = {
    // Vite dev port check for development, else always use production for Web and Android
    API_BASE_URL: (window.location.hostname === 'localhost' && window.location.port === '5173')
        ? 'http://localhost:5000/api'
        : 'https://cstore-backend.onrender.com/api'
};

export default config;
