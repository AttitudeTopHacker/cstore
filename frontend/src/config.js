export const fetchWithTimeout = async (url, options = {}, timeoutMs = 4000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            ...options,
            signal: options.signal || controller.signal,
        });
        clearTimeout(timeoutId);
        return res;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
};

const config = {
    // Force Render backend on Android/iOS Capacitor and Production Web
    API_BASE_URL: (window.location.hostname === 'localhost' && window.location.port === '5173')
        ? 'http://localhost:5000/api'
        : 'https://cstore-backend.onrender.com/api'
};

export default config;

