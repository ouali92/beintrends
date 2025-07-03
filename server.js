const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// --- العودة إلى المسار المحلي المتوافق مع الخطة المجانية ---
// هذا هو التعديل الوحيد والأهم
const DB_PATH = path.join(__dirname, 'db.json');


// --- باقي الكود يبقى كما هو تماماً ---

// قائمة الدول الجديدة لليوتيوب
const YOUTUBE_REGIONS = [
    'SA', 'EG', 'US', 'GB', 'FR', 'DE', 'CA', 'AU', 'BR', 'IN',
    'JP', 'KR', 'RU', 'MX', 'IT', 'ES', 'TR', 'NL', 'SE', 'CH',
    'AE', 'QA', 'KW', 'BH', 'OM', 'DZ', 'MA', 'TN', 'IQ', 'JO'
];

function initializeDatabase() {
    if (!fs.existsSync(DB_PATH)) {
        console.log("db.json not found, creating a new one.");
        const initialData = { facebook: [], tiktok: {}, twitter: {}, youtube: {} };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
}

function readDB() {
    try {
        const dbRaw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(dbRaw);
    } catch (error) {
        console.error("Could not read db.json:", error);
        return { facebook: [], tiktok: {}, twitter: {}, youtube: {} };
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
        const oembedResponse = await fetch(`https://www.tiktok.com/oembed?url=${videoUrl}`);
        if (oembedResponse.ok) {
            const data = await oembedResponse.json();
            if (data.thumbnail_url) return data.thumbnail_url;
        }
        const videoPageResponse = await fetch(videoUrl);
        if(videoPageResponse.ok) {
            const html = await videoPageResponse.text();
            const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
            if (match && match[1]) return match[1];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching TikTok thumbnail for ${videoUrl}:`, error);
        return null;
    }
}

async function fetchAndUpdateYoutubeData() {
    console.log("Fetching YouTube Data for multiple regions...");
    const apiKey = 'AIzaSyB471LcL9_V96k1VOh3sKH909E3ibKND3U';
    const db = readDB();
    if (!db.youtube) db.youtube = {};
    for (const regionCode of YOUTUBE_REGIONS) {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${regionCode}&maxResults=20&key=${apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`YouTube API failed for ${regionCode}`);
            const youtubeData = await response.json();
            db.youtube[regionCode] = youtubeData.items || [];
            console.log(`Updated YouTube data for ${regionCode}`);
        } catch (error) {
            console.error(`Failed to update YouTube for ${regionCode}:`, error.message);
        }
    }
    writeDB(db);
    console.log("YouTube Data Updated successfully for all regions.");
}

app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '50mb' }));

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
    console.log(`Server is running on port ${PORT}`);
    fetchAndUpdateYoutubeData();
    setInterval(fetchAndUpdateYoutubeData, 6 * 60 * 60 * 1000);
});