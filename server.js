const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;
const DB_PATH = path.join(__dirname, 'db.json');

// إعدادات CORS الموسعة
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json({ limit: '50mb' }));

// إنشاء قاعدة بيانات إذا لم تكن موجودة
function initializeDatabase() {
    if (!fs.existsSync(DB_PATH)) {
        console.log("Creating new database file...");
        const initialData = { facebook: [], tiktok: {}, twitter: {}, youtube: {} };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
}

// قراءة قاعدة البيانات
function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch (error) {
        console.error("Database read error:", error);
        return { facebook: [], tiktok: {}, twitter: {}, youtube: {} };
    }
}

// كتابة قاعدة البيانات
function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Database write error:", error);
    }
}

// واجهة API للبيانات
app.get('/api/trends', (req, res) => {
    try {
        const data = readDB();
        console.log('Successfully served trends data');
        res.status(200).json(data);
    } catch (error) {
        console.error('Failed to serve trends:', error);
        res.status(500).json({ error: 'Failed to load data' });
    }
});

// واجهة التحديث
app.post('/api/update', async (req, res) => {
    try {
        const { platform, data } = req.body;
        if (!platform || !data) {
            return res.status(400).json({ message: 'بيانات ناقصة' });
        }

        const db = readDB();
        db[platform] = data;
        writeDB(db);

        console.log(`Updated ${platform} data successfully`);
        res.status(200).json({ message: 'تم التحديث بنجاح' });
    } catch (error) {
        console.error('Update failed:', error);
        res.status(500).json({ error: 'فشل التحديث' });
    }
});

// صفحة الاختبار
app.get('/test', (req, res) => {
    res.send(`
        <h1>الخادم يعمل بنجاح!</h1>
        <p>يمكنك اختبار واجهة البرمجة (API) عبر الروابط التالية:</p>
        <ul>
            <li><a href="/api/trends">/api/trends</a> - لاستعراض البيانات</li>
        </ul>
    `);
});

// بدء الخادم
app.listen(PORT, () => {
    initializeDatabase();
    console.log(`
    ====================================
    الخادم يعمل على البورت ${PORT}
    روابط مهمة:
    - http://localhost:${PORT}/test
    - http://localhost:${PORT}/api/trends
    ====================================
    `);
});