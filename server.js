const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;
const DB_PATH = path.join(__dirname, 'db.json');

// --- إعدادات الخادم ---
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '50mb' }));

// --- دوال مساعدة ---
function readDB() {
    if (!fs.existsSync(DB_PATH)) {
        writeDB({ facebook: [], tiktok: {}, twitter: {}, youtube: [] });
    }
    try {
        const dbRaw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(dbRaw);
    } catch (error) {
        return { facebook: [], tiktok: {}, twitter: {}, youtube: [] };
    }
}
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// --- دالة جلب الصور النهائية والأكثر قوة ---
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

// --- الواجهات البرمجية (APIs) ---
app.get('/api/trends', (req, res) => {
    console.log('Serving main trends to public site.');
    const db = readDB();
    const publicData = {
        facebook: db.facebook,
        tiktok: db.tiktok,
        twitter: db.twitter,
    };
    res.json(publicData);
});

app.get('/api/youtube/:countryCode', async (req, res) => {
    const { countryCode } = req.params;
    console.log(`Fetching YouTube for ${countryCode}`);
    const apiKey = 'AIzaSyB471LcL9_V96k1VOh3sKH909E3ibKND3U';
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${countryCode}&maxResults=20&key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        res.json(data.items || []);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch YouTube data' });
    }
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));