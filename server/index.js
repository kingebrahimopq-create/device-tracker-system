// server/index.js – الخادم المركزي + لوحة التحكم
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== الإعدادات العامة ==========
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // للملفات الثابتة (اختياري)

// إدارة الجلسات (للمصادقة)
app.use(session({
    secret: 'supersecretkey2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // ضع true إذا كنت تستخدم HTTPS
}));

// ========== قاعدة البيانات المؤقتة (في الذاكرة) ==========
let devices = {}; // مفتاح: deviceId، القيمة: معلومات الجهاز + قائمة الأوامر
let adminLoggedIn = false; // نبسطها، لكن الأفضل استخدام session

// المفاتيح الثابتة (يمكن تحسينها)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Tracker@2099';

// ========== دوال مساعدة ==========
// توليد مفتاح تشفير فريد لكل جهاز
function generateDeviceKey(deviceId) {
    return crypto.createHash('sha256').update(deviceId + 'globalSalt').digest('hex').substring(0, 32);
}

// تشفير AES-256-CBC
function encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText, key) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// التحقق من المصادقة (لصفحات الإدارة)
function requireAuth(req, res, next) {
    if (req.session.loggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
}

// ========== مسارات API للأجهزة ==========
// تسجيل جهاز جديد
app.post('/api/register', (req, res) => {
    const { deviceId, model, os, manufacturer } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId مطلوب' });

    const key = generateDeviceKey(deviceId);
    if (!devices[deviceId]) {
        devices[deviceId] = {
            deviceId,
            model: model || 'unknown',
            os: os || 'unknown',
            manufacturer: manufacturer || 'unknown',
            firstSeen: new Date().toISOString(),
            lastCheckin: null,
            battery: null,
            network: null,
            location: null,
            commands: [] // قائمة الأوامر المرسلة (لم يتم تنفيذها بعد)
        };
    }
    res.json({ status: 'registered', deviceId, key });
});

// Check-in دوري (يرسل الجهاز حالته ويستقبل الأوامر)
app.post('/api/checkin', (req, res) => {
    const { deviceId, battery, network, location } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId مطلوب' });

    const device = devices[deviceId];
    if (!device) {
        return res.status(404).json({ error: 'جهاز غير مسجل' });
    }

    // تحديث آخر معلومات
    device.lastCheckin = new Date().toISOString();
    if (battery) device.battery = battery;
    if (network) device.network = network;
    if (location) device.location = location;

    // إرجاع الأوامر المعلقة (ثم حذفها)
    const pendingCommands = [...device.commands];
    device.commands = []; // مسح الأوامر بعد إرسالها

    res.json({
        status: 'ok',
        commands: pendingCommands
    });
});

// إرسال نتيجة تنفيذ أمر (من الجهاز)
app.post('/api/command-result', (req, res) => {
    const { deviceId, command, result, error } = req.body;
    console.log(`[نتيجة أمر] الجهاز ${deviceId} الأمر ${command}: ${result ? 'نجاح' : 'فشل'}`, error || '');
    // هنا يمكن تخزين النتائج في سجل النشاطات (للتوسع)
    res.json({ received: true });
});

// ========== مسارات لوحة التحكم (مع المصادقة) ==========
// صفحة تسجيل الدخول
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// معالجة تسجيل الدخول
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/dashboard');
    } else {
        res.send('<h1>خطأ في اسم المستخدم أو كلمة المرور</h1><a href="/login">عودة</a>');
    }
});

// تسجيل الخروج
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// لوحة التحكم الرئيسية
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// واجهة برمجة للحصول على قائمة الأجهزة (JSON)
app.get('/api/devices', requireAuth, (req, res) => {
    res.json(devices);
});

// إرسال أمر إلى جهاز معين
app.post('/api/send-command', requireAuth, (req, res) => {
    const { deviceId, command, parameters } = req.body;
    if (!deviceId || !command) {
        return res.status(400).json({ error: 'deviceId و command مطلوبان' });
    }
    const device = devices[deviceId];
    if (!device) {
        return res.status(404).json({ error: 'الجهاز غير موجود' });
    }

    // إضافة الأمر إلى قائمة انتظار الجهاز
    const cmdObj = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        command,
        parameters: parameters || {},
        timestamp: new Date().toISOString()
    };
    device.commands.push(cmdObj);

    // يمكن إضافة سجل نشاطات (اختياري)
    console.log(`[أمر] إرسال الأمر ${command} إلى ${deviceId}`);

    res.json({ status: 'queued', commandId: cmdObj.id });
});

// ========== تشغيل الخادم ==========
app.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
});