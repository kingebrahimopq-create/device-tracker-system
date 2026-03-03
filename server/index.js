const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const Device = require('./models/Device');
const Log = require('./models/Log');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// ========== الإعدادات العامة ==========
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== الاتصال بقاعدة البيانات ==========
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ متصل بـ MongoDB'))
  .catch(err => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));

// ========== دوال مساعدة ==========
function generateDeviceKey(deviceId) {
    return crypto.createHash('sha256').update(deviceId + process.env.JWT_SECRET).digest('hex').substring(0, 32);
}

// تسجيل الأحداث في قاعدة البيانات
async function logEvent(deviceId, event, details = {}) {
    try {
        await Log.create({ deviceId, event, details });
    } catch (err) {
        console.error('فشل في تسجيل الحدث:', err);
    }
}

// ========== API عام للأجهزة (بدون مصادقة) ==========
// تسجيل جهاز جديد
app.post('/api/register', async (req, res) => {
    try {
        const { deviceId, model, os, manufacturer } = req.body;
        if (!deviceId) return res.status(400).json({ error: 'deviceId مطلوب' });

        let device = await Device.findOne({ deviceId });
        if (!device) {
            device = new Device({ deviceId, model, os, manufacturer });
            await device.save();
            await logEvent(deviceId, 'register', { model, os, manufacturer });
        } else {
            // تحديث المعلومات إذا كان موجوداً
            device.model = model || device.model;
            device.os = os || device.os;
            device.manufacturer = manufacturer || device.manufacturer;
            await device.save();
        }

        const key = generateDeviceKey(deviceId);
        res.json({ status: 'registered', deviceId, key });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ داخلي' });
    }
});

// Check-in دوري
app.post('/api/checkin', async (req, res) => {
    try {
        const { deviceId, battery, network, location } = req.body;
        if (!deviceId) return res.status(400).json({ error: 'deviceId مطلوب' });

        const device = await Device.findOne({ deviceId });
        if (!device) return res.status(404).json({ error: 'جهاز غير مسجل' });

        // تحديث البيانات
        device.lastCheckin = new Date();
        if (battery !== undefined) device.battery = battery;
        if (network) device.network = network;
        if (location) device.location = location;

        // جلب الأوامر المعلقة (pending)
        const pendingCommands = device.commands.filter(cmd => cmd.status === 'pending');
        // تحديث حالة الأوامر إلى 'sent'
        pendingCommands.forEach(cmd => cmd.status = 'sent');
        await device.save();

        // تسجيل حدث check-in
        await logEvent(deviceId, 'checkin', { battery, network, location });

        // بث التحديث عبر WebSocket إلى لوحة التحكم
        io.emit('device-update', { deviceId, battery, network, location, lastCheckin: device.lastCheckin });

        res.json({
            status: 'ok',
            commands: pendingCommands.map(c => ({ id: c._id, command: c.command, parameters: c.parameters }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ داخلي' });
    }
});

// إرسال نتيجة أمر
app.post('/api/command-result', async (req, res) => {
    try {
        const { deviceId, commandId, result, error } = req.body;
        const device = await Device.findOne({ deviceId });
        if (!device) return res.status(404).json({ error: 'جهاز غير موجود' });

        const cmd = device.commands.id(commandId);
        if (cmd) {
            cmd.status = error ? 'failed' : 'completed';
            cmd.result = result || null;
            cmd.executedAt = new Date();
            await device.save();

            await logEvent(deviceId, 'command_result', { command: cmd.command, result, error });
            io.emit('command-result', { deviceId, commandId, result, error });
        }

        res.json({ received: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ داخلي' });
    }
});

// ========== API للإدارة (باستخدام JWT) ==========
// تسجيل الدخول وإصدار JWT
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'بيانات غير صحيحة' });
    }
});

// الحصول على جميع الأجهزة (مع فلترة اختيارية)
app.get('/api/devices', authMiddleware, async (req, res) => {
    try {
        const devices = await Device.find().sort('-lastCheckin');
        res.json(devices);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في جلب الأجهزة' });
    }
});

// إرسال أمر إلى جهاز
app.post('/api/send-command', authMiddleware, async (req, res) => {
    try {
        const { deviceId, command, parameters } = req.body;
        if (!deviceId || !command) return res.status(400).json({ error: 'deviceId و command مطلوبان' });

        const device = await Device.findOne({ deviceId });
        if (!device) return res.status(404).json({ error: 'الجهاز غير موجود' });

        const newCommand = {
            command,
            parameters: parameters || {},
            timestamp: new Date(),
            status: 'pending'
        };
        device.commands.push(newCommand);
        await device.save();

        await logEvent(deviceId, 'command_sent', { command, parameters });
        io.emit('new-command', { deviceId, command: newCommand });

        res.json({ status: 'queued', commandId: newCommand._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في إرسال الأمر' });
    }
});

// الحصول على سجل النشاطات
app.get('/api/logs', authMiddleware, async (req, res) => {
    try {
        const { deviceId, limit = 100 } = req.query;
        const filter = deviceId ? { deviceId } : {};
        const logs = await Log.find(filter).sort('-timestamp').limit(parseInt(limit));
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في جلب السجلات' });
    }
});

// ========== WebSocket للوحة التحكم ==========
io.on('connection', (socket) => {
    console.log('🟢 لوحة تحكم متصلة:', socket.id);
    socket.on('disconnect', () => {
        console.log('🔴 لوحة تحكم مفصولة:', socket.id);
    });
});

// ========== تشغيل الخادم ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
});