const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// المسار الدائم للتخزين على Render
const DATA_DIR = '/data';
const DB_PATH = path.join(DATA_DIR, 'db.json');

function initializeDatabase() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
        console.log("db.json not found, creating a new one in /data.");
        const initialData = { facebook: [], tiktok: {}, twitter: {}, youtube: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
}

function readDB() {
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

async function getFacebookThumbnail(postLink) {
    if (!postLink || !postLink.includes('facebook.com')) return null;
    const proxyUrl = 'https://solitary-disk-d143.kakaouali.workers.dev/?url=';
    try {
        const response = await fetch(proxyUrl + encodeURIComponent(postLink));
        if (!response.ok) return null;
        const html = await response.text();
        const patterns = [/<meta\s+property="og:image"\s+content="([^"]+)"/, /<meta\s+property="og:image:secure_url"\s+content="([^"]+)"/, /<img\s+class="[^"]*scaledImageFitWidth[^"]*"\s+src="([^"]+)"/];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) return match[1].replace(/&amp;/g, '&');
        }
        return null;
    } catch (error) { return null; }
}

async function getTikTokThumbnail(videoUrl) {
    try {
        const response = await fetch(`https://www.tiktok.com/oembed?url=${videoUrl}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.thumbnail_url || null;
    } catch (error) { return null; }
}

app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '50mb' }));

// --- الواجهات البرمجية (APIs) ---
app.get('/api/trends', (req, res) => res.json(readDB()));

app.get('/api/youtube/:countryCode', async (req, res) => {
    const { countryCode } = req.params;
    const apiKey = 'AIzaSyB471LcL9_V96k1VOh3sKH909E3ibKND3U';
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${countryCode}&maxResults=20&key=${apiKey}`;
    try {
        const response = await fetch(url);
        res.json(await response.json());
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
        finalData = await Promise.all(data.map(async (post) => ({ ...post, thumbnailUrl: await getFacebookThumbnail(post.postLink) })));
    }
    if (platform === 'tiktok' && typeof data === 'object') {
        const enrichedTikTok = {};
        for (const country in data) {
            enrichedTikTok[country] = await Promise.all(data[country].map(async (videoUrl) => ({ url: videoUrl, thumbnailUrl: await getTikTokThumbnail(videoUrl) })));
        }
        finalData = enrichedTikTok;
    }
    
    db[platform] = finalData;
    writeDB(db);
    res.status(200).json({ message: 'Update successful' });
});

app.listen(PORT, () => {
    initializeDatabase();
    console.log(`Server is running on port ${PORT} and using persistent storage at ${DB_PATH}`);
});