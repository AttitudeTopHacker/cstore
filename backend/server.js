const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// JWT Secret and Admin Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
// Admin credentials removed (now database-driven)

app.use(cors());
app.use(express.json());

// Multer Setup (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() });

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────

const authenticateUser = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin access required.' });
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

// Login User
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

        // (Hardcoded admin check removed)

        // Check regular user
        const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
        if (error || !user) return res.status(401).json({ error: 'Invalid email or password.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password.' });

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Login successful!', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Google Login Sync
app.post('/api/auth/google-sync', async (req, res) => {
    try {
        const { email, name, supabase_id } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Check if user exists in our DB
        let { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 means not found

        if (!user) {
            // New user from Google
            return res.status(200).json({ isNew: true, message: 'User needs to complete profile' });
        }

        // Existing user - generate token
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ isNew: false, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Complete Profile for Google Users
app.post('/api/auth/complete-profile', async (req, res) => {
    try {
        const { email, name, password } = req.body;
        if (!email || !name || !password) return res.status(400).json({ error: 'All fields are required' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: user, error } = await supabase.from('users').insert([{
            name, email, password: hashedPassword, role: 'user'
        }]).select().single();

        if (error) throw error;

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ message: 'Profile completed!', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PUBLIC APP ROUTES ───────────────────────────────────────────────────────

// Get All Apps
app.get('/api/apps', async (req, res) => {
    try {
        const { data, error } = await supabase.from('apps').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Track Download (authenticated users get download tracked)
app.put('/api/download/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Increment global download count
        const { error } = await supabase.rpc('increment_download_count', { app_id: id });
        if (error) throw error;

        // If user is authenticated, track their download
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded.id !== 'admin') {
                    await supabase.from('downloads').insert([{ user_id: decoded.id, app_id: id }]);
                }
            } catch (_) { /* ignore token errors for this optional tracking */ }
        }

        res.status(200).json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── USER ROUTES (authenticated) ─────────────────────────────────────────────

// Get Current User Profile
app.get('/api/user/profile', authenticateUser, async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            return res.status(200).json({ id: 'admin', name: 'Admin', email: ADMIN_EMAIL, role: 'admin', created_at: new Date().toISOString() });
        }
        const { data, error } = await supabase.from('users').select('id, name, email, role, created_at').eq('id', req.user.id).single();
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User's Download History
app.get('/api/user/downloads', authenticateUser, async (req, res) => {
    try {
        if (req.user.role === 'admin') return res.status(200).json([]);
        const { data, error } = await supabase
            .from('downloads')
            .select('id, downloaded_at, apps(id, name, version, icon_url, size)')
            .eq('user_id', req.user.id)
            .order('downloaded_at', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// Get All Users (Admin only)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, email, role, created_at')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Admin Stats (Admin only)
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const [usersRes, appsRes, downloadsRes] = await Promise.all([
            supabase.from('users').select('id', { count: 'exact', head: true }),
            supabase.from('apps').select('id, download_count'),
            supabase.from('downloads').select('id', { count: 'exact', head: true }),
        ]);

        const totalUsers = usersRes.count || 0;
        const totalApps = appsRes.data ? appsRes.data.length : 0;
        const totalDownloads = appsRes.data ? appsRes.data.reduce((sum, a) => sum + (a.download_count || 0), 0) : 0;

        res.status(200).json({ totalUsers, totalApps, totalDownloads });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload New App (Authenticated users)
app.post('/api/upload', authenticateUser, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'icon', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, version, description } = req.body;
        const appFile = req.files['file'][0];
        const iconFile = req.files['icon'] ? req.files['icon'][0] : null;

        if (!appFile) return res.status(400).json({ error: 'App file is required' });

        // Upload App File
        const appFileName = `${Date.now()}-${appFile.originalname}`;
        const { error: appError } = await supabase.storage.from('cstore-apps').upload(appFileName, appFile.buffer, { contentType: appFile.mimetype });
        if (appError) throw appError;
        const fileUrl = `${supabaseUrl}/storage/v1/object/public/cstore-apps/${appFileName}`;

        // Upload Icon File (Optional)
        let iconUrl = null;
        if (iconFile) {
            const iconFileName = `${Date.now()}-${iconFile.originalname}`;
            const { error: iconError } = await supabase.storage.from('cstore-icons').upload(iconFileName, iconFile.buffer, { contentType: iconFile.mimetype });
            if (iconError) throw iconError;
            iconUrl = `${supabaseUrl}/storage/v1/object/public/cstore-icons/${iconFileName}`;
        }

        // Insert Metadata
        const { error: dbError } = await supabase.from('apps').insert([{
            name, version, description, file_url: fileUrl, icon_url: iconUrl,
            download_count: 0, size: (appFile.size / (1024 * 1024)).toFixed(2) + ' MB'
        }]);
        if (dbError) throw dbError;

        res.status(201).json({ message: 'App uploaded successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete App (Admin only)
app.delete('/api/admin/apps/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('apps').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'App deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete User (Admin only)
app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(port, () => {
    console.log(`🚀 CStore Server running on port ${port}`);
});
