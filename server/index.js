// server/index.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// قاعدة بيانات الأجهزة
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
            return JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));        } catch (e) {
            return { commands: [] };
        }
    }
}

// =========================================
// 🔹 الصفحة الرئيسية - HTML
// =========================================

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Device Tracker Server</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        .logo {
            width: 120px;
            height: 120px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 30px;
            box-shadow: 0 20px 60px rgba(102, 126, 234, 0.4);
            animation: pulse 2s infinite, float 3s ease-in-out infinite;
        }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .logo i { font-size: 60px; color: white; }
        h1 { font-size: 2.5rem; margin-bottom: 20px; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
        .status {            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            border-radius: 25px;
            margin: 20px 0;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
            animation: pulse 2s infinite;
        }
        .card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            margin: 20px 0;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .info-item {
            background: rgba(255,255,255,0.05);
            padding: 15px;
            border-radius: 12px;
            text-align: left;
        }
        .info-item i { font-size: 24px; margin-bottom: 8px; display: block; color: #667eea; }
        .info-item p { color: rgba(255,255,255,0.7); font-size: 14px; }
        .info-item strong { color: #fff; font-size: 16px; }
        .endpoints {
            margin-top: 30px;
        }
        .endpoint {
            display: inline-block;
            padding: 12px 25px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            margin: 8px;
            text-decoration: none;
            color: white;
            font-weight: 600;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .endpoint:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6); }
        .stats {            background: rgba(34, 197, 94, 0.1);
            border: 2px solid #22c55e;
            border-radius: 15px;
            padding: 20px;
            margin: 20px 0;
        }
        .stats h3 { color: #22c55e; margin-bottom: 10px; }
        .stats p { color: rgba(255,255,255,0.9); margin: 5px 0; }
        footer {
            margin-top: 40px;
            color: rgba(255,255,255,0.5);
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo"><i class="fas fa-shield-alt"></i></div>
        <h1>Device Tracker Server</h1>
        <div class="status"><i class="fas fa-check-circle"></i> Server is Running</div>
        
        <div class="card">
            <div class="info-grid">
                <div class="info-item">
                    <i class="fas fa-server" style="color: #667eea;"></i>
                    <p>Version</p>
                    <strong>2.0.0</strong>
                </div>
                <div class="info-item">
                    <i class="fas fa-circle" style="color: #22c55e;"></i>
                    <p>Status</p>
                    <strong>Active</strong>
                </div>
                <div class="info-item">
                    <i class="fas fa-port" style="color: #f59e0b;"></i>
                    <p>Port</p>
                    <strong>3000</strong>
                </div>
                <div class="info-item">
                    <i class="fas fa-clock" style="color: #a855f7;"></i>
                    <p>Time</p>
                    <strong>${new Date().toLocaleString('ar-EG')}</strong>
                </div>
            </div>
        </div>

        <div class="stats">
            <h3><i class="fas fa-chart-line"></i> Statistics</h3>
            <p><strong>Total Devices:</strong> ${clientsDB.size}</p>
            <p><strong>Active Connections:</strong> ${Array.from(clientsDB.values()).filter(c => c.status === 'active').length}</p>            <p><strong>Server Uptime:</strong> <span id="uptime">Calculating...</span></p>
        </div>

        <div class="endpoints">
            <h2 style="margin-bottom: 20px;">API Endpoints</h2>
            <a href="/api/devices" class="endpoint"><i class="fas fa-mobile-alt"></i> View Devices</a>
            <a href="/api/clients/register" class="endpoint"><i class="fas fa-user-plus"></i> Register Device</a>
            <a href="/api/config/generate" class="endpoint"><i class="fas fa-cog"></i> Generate Config</a>
        </div>

        <footer>
            <p>Device Tracker System v2.0 | Secure & Encrypted Communication</p>
            <p style="margin-top: 10px;">${new Date().getFullYear()} All rights reserved</p>
        </footer>
    </div>

    <script>
        // تحديث وقت التشغيل
        const startTime = Date.now();
        setInterval(() => {
            const uptime = Math.floor((Date.now() - startTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            document.getElementById('uptime').textContent = \`\${hours}h \${minutes}m \${seconds}s\`;
        }, 1000);
    </script>
</body>
</html>
    `);
});

// =========================================
// 🔹 API Endpoints
// =========================================

// تسجيل جهاز جديد
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
            registeredAt: new Date().toISOString(),            status: 'active',
            lastCheckIn: null,
            lastReport: null
        };
        
        clientsDB.set(deviceId, client);
        commandsQueue.set(deviceId, []);
        
        console.log(\`✅ New device: \${deviceId}\`);
        res.json({ success: true, deviceId, encryptionKey, message: 'Registered' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check-in من الجهاز
app.post('/api/clients/checkin', (req, res) => {
    try {
        const { deviceId, encryptedData } = req.body;
        if (!deviceId) return res.status(400).json({ success: false, error: 'deviceId required' });
        
        const client = clientsDB.get(deviceId);
        if (!client) return res.status(404).json({ success: false, error: 'Device not found' });
        
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

// استقبال تقرير
app.post('/api/clients/report', (req, res) => {
    try {
        const { deviceId, commandId, result, status, data }