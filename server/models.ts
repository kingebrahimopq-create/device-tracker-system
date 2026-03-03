const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const clientsDB = new Map();

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

// فك تشفير البيانات
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
    } catch (e) {
      return { commands: [] };
    }
  }
}

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🖥️ Device Tracker Server is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      register: 'POST /api/clients/register',
      checkin: 'POST /api/clients/checkin',
      report: 'POST /api/clients/report',
      devices: 'GET /api/devices'
    }
  });
});

// تسجيل جهاز جديد
app.post('/api/clients/register', (req, res) => {
  try {
    const { clientId, deviceInfo } = req.body;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId is required'
      });
    }
    const deviceId = 'device_' + crypto.randomUUID();
    const encryptionKey = generateEncryptionKey();
    const client = {
      deviceId,
      clientId,
      encryptionKey,
      deviceInfo: deviceInfo || {},
      registeredAt: new Date().toISOString(),
      status: 'active',
      lastCheckIn: null
    };
    clientsDB.set(deviceId, client);
    console.log(`✅ New device registered: ${deviceId}`);
    console.log(`   Client ID: ${clientId}`);
    res.json({
      success: true,
      deviceId,
      encryptionKey,
      message: 'Device registered successfully'
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check-in من الجهاز
app.post('/api/clients/checkin', (req, res) => {
  try {
    const { deviceId, encryptedData, command } = req.body;
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required'
      });
    }
    const client = clientsDB.get(deviceId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    // تحديث آخر اتصال
    client.lastCheckIn = new Date().toISOString();
    client.status = 'active';
    clientsDB.set(deviceId, client);
    // فك تشفير البيانات الواردة
    let decryptedData = {};
    if (encryptedData) {
      decryptedData = decryptData(encryptedData, client.encryptionKey);
    }
    console.log(`📡 Check-in from: ${deviceId}`);
    console.log(`   Data:`, decryptedData);
    // تجهيز الأوامر (فارغة حالياً)
    const responseData = {
      commands: command ? [command] : []
    };
    const encryptedResponse = encryptData(responseData, client.encryptionKey);
    res.json({
      success: true,
      encryptedData: encryptedResponse,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Check-in error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// استقبال تقرير من الجهاز
app.post('/api/clients/report', (req, res) => {
  try {
    const { deviceId, commandId, result, status, data } = req.body;
    console.log(`📊 Report received from: ${deviceId || 'unknown'}`);
    if (commandId) {
      console.log(`   Command ID: ${commandId}`);
      console.log(`   Status: ${status}`);
      console.log(`   Result:`, result);
    }
    if (data) {
      console.log(`   Data:`, data);
    }
    res.json({
      success: true,
      message: 'Report received successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// جلب جميع الأجهزة
app.get('/api/devices', (req, res) => {
  try {
    const devices = Array.from(clientsDB.values()).map(client => ({
      deviceId: client.deviceId,
      clientId: client.clientId,
      deviceInfo: client.deviceInfo,
      status: client.status,
      registeredAt: client.registeredAt,
      lastCheckIn: client.lastCheckIn
    }));
    res.json({
      success: true,
      count: devices.length,
      devices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get devices error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// إرسال أمر لجهاز معين
app.post('/api/devices/:deviceId/command', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { type, payload } = req.body;
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Command type is required'
      });
    }
    const client = clientsDB.get(deviceId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    const command = {
      id: 'cmd_' + crypto.randomUUID(),
      type,
      payload: payload || {},
      timestamp: new Date().toISOString()
    };
    // تخزين الأمر لتنفيذه في الـ check-in التالي
    if (!client.pendingCommands) {
      client.pendingCommands = [];
    }
    client.pendingCommands.push(command);
    clientsDB.set(deviceId, client);
    console.log(`📤 Command queued for ${deviceId}: ${type}`);
    res.json({
      success: true,
      command,
      message: 'Command queued successfully'
    });
  } catch (error) {
    console.error('❌ Command error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// تشغيل الخادم
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   🖥️ DEVICE TRACKER SERVER                 ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║   🌐 Server running on port ${PORT}            ║`);
  console.log(`║   📍 Host: ${HOST}                         ║`);
  console.log(`║   🔗 URL: https://${process.env.REPL_SLUG || 'localhost'}.${process.env.REPL_OWNER ? process.env.REPL_OWNER + '.repl.co' : 'localhost:3000'}`);
  console.log('║                                             ║');
  console.log('║   Endpoints:                                ║');
  console.log('║   • GET  /                                  ║');
  console.log('║   • POST /api/clients/register              ║');
  console.log('║   • POST /api/clients/checkin               ║');
  console.log('║   • POST /api/clients/report                ║');
  console.log('║   • GET  /api/devices                       ║');
  console.log('║   • POST /api/devices/:id/command           ║');
  console.log('╚═══════════════════════════════════════════╝');
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

module.exports = app;
