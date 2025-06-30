const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;
const DB_PATH = path.join(__dirname, 'db.json');

// --- دالة لضمان وجود ملف قاعدة البيانات ---
function initializeDatabase() {
    if (!fs.existsSync(DB_PATH)) {
        console.log("db.json not found, creating a new one.");
        const initialData = { facebook: [], tiktok: {}, twitter: {}, youtube: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
}

// --- دوال مساعدة ---
function readDB() {
    try {
        const dbRaw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(dbRaw);
    } catch (error) {
        console.error("Could not read db.json:", error);
        return { facebook: [], tiktok: {}, twitter: {}, youtube: [] }; // Return empty structure on error
    }
}
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

async function getFacebookThumbnail(postLink) {
    if (!postLink || !postLink.includes('facebook.com')) return null;
    const proxyUrl = 'https://solitary-disk-d143.kakaouali.workers.dev/?url=';
    try {
        const response = await fetch(proxyUrl + encodeURIComponent(postLink));
        if (!response.ok) return null;
        const html = await response.text();
        const patterns = [
            /<meta\s+property="og:image"\s+content="([^"]+)"/,
            /<meta\s+property="og:image:secure_url"\s+content="([^"]+)"/,
            /<img\s+class="[^"]*scaledImageFitWidth[^"]*"\s+src="([^"]+)"/,
            /<img\s+src="([^"]+)"\s+alt="[^"]*may be an image[^"]*"/
        ];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return match[1].replace(/&amp;/g, '&');
            }
        }
        return null;
    } catch (error) { return null; }
}

// --- إعدادات الخادم ---
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '50mb' }));


// --- الواجهات البرمجية (APIs) ---
app.get('/api/trends', (req, res) => {
    console.log('Serving all trends to public site.');
    res.json(readDB());
});

app.post('/api/update', async (req, res) => {
    const { platform, data } = req.body;
    if (!platform || !data) return res.status(400).json({ message: 'Missing data' });
    
    console.log(`Received update for: ${platform}`);
    const db = readDB();
    let finalData = data;

    if (platform === 'facebook' && Array.isArray(data)) {
        console.log("Enriching Facebook data with thumbnails...");
        finalData = await Promise.all(
            data.map(async (post) => ({ ...post, thumbnailUrl: await getFacebookThumbnail(post.postLink) }))
        );
        console.log("Enrichment complete.");
    }
    
    db[platform] = finalData;
    writeDB(db);
    res.status(200).json({ message: 'Update successful' });
});

// --- تشغيل الخادم ---
app.listen(PORT, () => {
    initializeDatabase(); // تأكد من وجود قاعدة البيانات عند التشغيل
    console.log(`Server is running on port ${PORT}`);
    // لا حاجة لجلب يوتيوب هنا لأنه يتم جلبه من الموقع العام الآن
});