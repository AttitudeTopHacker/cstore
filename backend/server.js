const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// Multer Setup (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() });

// --- ROUTES ---

// 1. Get All Apps
app.get('/api/apps', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('apps')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Upload New App
app.post('/api/upload', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'icon', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, version, description } = req.body;
        const appFile = req.files['file'][0];
        const iconFile = req.files['icon'] ? req.files['icon'][0] : null;

        if (!appFile) return res.status(400).json({ error: 'App file is required' });

        // A. Upload App File to Supabase Storage
        const appFileName = `${Date.now()}-${appFile.originalname}`;
        const { data: appData, error: appError } = await supabase.storage
            .from('cstore-apps')
            .upload(appFileName, appFile.buffer, { contentType: appFile.mimetype });

        if (appError) throw appError;
        const fileUrl = `${supabaseUrl}/storage/v1/object/public/cstore-apps/${appFileName}`;

        // B. Upload Icon File (Optional)
        let iconUrl = null;
        if (iconFile) {
            const iconFileName = `${Date.now()}-${iconFile.originalname}`;
            const { data: iconData, error: iconError } = await supabase.storage
                .from('cstore-icons')
                .upload(iconFileName, iconFile.buffer, { contentType: iconFile.mimetype });

            if (iconError) throw iconError;
            iconUrl = `${supabaseUrl}/storage/v1/object/public/cstore-icons/${iconFileName}`;
        }

        // C. Insert Metadata into Database
        const { data: dbData, error: dbError } = await supabase
            .from('apps')
            .insert([{
                name,
                version,
                description,
                file_url: fileUrl,
                icon_url: iconUrl,
                download_count: 0,
                size: (appFile.size / (1024 * 1024)).toFixed(2) + ' MB'
            }]);

        if (dbError) throw dbError;

        res.status(201).json({ message: 'App uploaded successfully', data: dbData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Track Download
app.put('/api/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.rpc('increment_download_count', { app_id: id });
        
        if (error) throw error;
        res.status(200).json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
