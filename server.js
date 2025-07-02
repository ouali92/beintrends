const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;
const DB_PATH = path.join(__dirname, 'db.json');

// --- دوال مساعدة ---
function initializeDatabase() { /* نفس الكود من الإجابة السابقة */ }
function readDB() { /* نفس الكود من الإجابة السابقة */ }
function writeDB(data) { /* نفس الكود من الإجابة السابقة */ }
async function getFacebookThumbnail(postLink) { /* نفس الكود القوي من الإجابة السابقة */ }

// --- دالة جديدة لجلب صور تيكتوك ---
async function getTikTokThumbnail(videoUrl) {
    try {
        const response = await fetch(`https://www.tiktok.com/oembed?url=${videoUrl}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.thumbnail_url || null;
    } catch (error) { return null; }
}

// --- دالة تحديث يوتيوب (تمت إعادتها) ---
async function fetchAndUpdateYoutubeData() {
    console.log("Fetching YouTube Data for SA region...");
    const apiKey = 'AIzaSyB471LcL9_V96k1VOh3sKH909E3ibKND3U';
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=SA&maxResults=20&key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('YouTube API request failed');
        const youtubeData = await response.json();
        const db = readDB();
        db.youtube = youtubeData.items || [];
        writeDB(db);
        console.log("YouTube Data Updated successfully.");
    } catch (error) {
        console.error("Failed to update YouTube data:", error.message);
    }
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
        console.log("Enriching Facebook data...");
        finalData = await Promise.all(
            data.map(async (post) => ({ ...post, thumbnailUrl: await getFacebookThumbnail(post.postLink) }))
        );
    }

    if (platform === 'tiktok' && typeof data === 'object') {
        console.log("Enriching TikTok data...");
        const enrichedTikTok = {};
        for (const country in data) {
            enrichedTikTok[country] = await Promise.all(
                data[country].map(async (videoUrl) => ({
                    url: videoUrl,
                    thumbnailUrl: await getTikTokThumbnail(videoUrl)
                }))
            );
        }
        finalData = enrichedTikTok;
    }
    
    db[platform] = finalData;
    writeDB(db);
    res.status(200).json({ message: 'Update successful' });
});

// --- تشغيل الخادم ---
app.listen(PORT, () => {
    initializeDatabase();
    console.log(`Server is running on port ${PORT}`);
    // إعادة تفعيل جلب بيانات يوتيوب عند التشغيل وبشكل دوري
    fetchAndUpdateYoutubeData();
    setInterval(fetchAndUpdateYoutubeData, 6 * 60 * 60 * 1000);
});


// --- لصق الدوال المساعدة الكاملة هنا ---
function initializeDatabase() {
    if (!fs.existsSync(DB_PATH)) {
        console.log("db.json not found, creating a new one.");
        const initialData = { facebook: [], tiktok: {}, twitter: {}, youtube: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
}
function readDB() {
    try {
        const dbRaw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(dbRaw);
    } catch (error) {
        console.error("Could not read db.json:", error);
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
        const patterns = [ /<meta\s+property="og:image"\s+content="([^"]+)"/, /<meta\s+property="og:image:secure_url"\s+content="([^"]+)"/, /<img\s+class="[^"]*scaledImageFitWidth[^"]*"\s+src="([^"]+)"/, /<img\s+src="([^"]+)"\s+alt="[^"]*may be an image[^"]*"/ ];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) { return match[1].replace(/&amp;/g, '&'); }
        }
        return null;
    } catch (error) { return null; }
}