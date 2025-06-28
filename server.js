const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// --- إعدادات الخادم ---
app.use(cors()); // للسماح للموقع العام بالتحدث مع الخادم
app.use(bodyParser.json({ limit: '50mb' })); // لاستقبال البيانات من لوحة التحكم

// --- دالة لقراءة قاعدة البيانات ---
function readDB() {
    const dbRaw = fs.readFileSync(DB_PATH);
    return JSON.parse(dbRaw);
}

// --- دالة لكتابة قاعدة البيانات ---
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// --- واجهة برمجية (API) لجلب كل الترندات (للموقع العام) ---
app.get('/api/trends', (req, res) => {
    console.log('Request received for all trends.');
    const db = readDB();
    res.json(db);
});

// --- واجهة برمجية (API) لتحديث البيانات (من لوحة التحكم) ---
app.post('/api/update', (req, res) => {
    const { platform, data } = req.body;

    if (!platform || !data) {
        return res.status(400).json({ message: 'Platform and data are required.' });
    }

    console.log(`Updating data for: ${platform}`);
    const db = readDB();
    db[platform] = data;
    writeDB(db);

    res.json({ message: `${platform} data updated successfully!` });
});

// --- جلب بيانات يوتيوب بشكل دوري ---
async function fetchAndUpdateYoutubeData() {
    // انتبه: يجب وضع مفتاح الـ API كمتغير بيئة في الاستضافة وليس هنا مباشرة
    const apiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyB471LcL9_V96k1VOh3sKH909E3ibKND3U'; // استخدم مفتاحك هنا مؤقتاً
    const countryCode = 'SA'; // مثال: السعودية
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${countryCode}&maxResults=20&key=${apiKey}`;

    console.log("Fetching YouTube trending videos...");
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Error fetching from YouTube API");
            return;
        }
        const youtubeData = await response.json();
        const db = readDB();
        db.youtube = youtubeData.items || [];
        writeDB(db);
        console.log("YouTube data updated successfully.");
    } catch (error) {
        console.error('Error in fetchAndUpdateYoutubeData:', error);
    }
}

// --- تشغيل الخادم ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // جلب بيانات يوتيوب عند بدء التشغيل
    fetchAndUpdateYoutubeData();
    // تحديث بيانات يوتيوب كل 6 ساعات
    setInterval(fetchAndUpdateYoutubeData, 6 * 60 * 60 * 1000);
});