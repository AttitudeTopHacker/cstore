const config = {
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:5000/api'
        : 'https://cstore-backend.onrender.com/api'
};

export default config;
