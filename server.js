const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

const clientsDB = new Map();
const commandsDB = new Map();

function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

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

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Device Tracker Server Running',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/clients/register', (req, res) => {
  try {
    const { clientId, deviceInfo } = req.body;
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
      registeredAt: new Date().toISOString(),
      status: 'active',
      lastCheckIn: null,
      pendingCommands: []
    };
    clientsDB.set(deviceId, client);
    res.json({
      success: true,
      deviceId,
      encryptionKey,
      message: 'Device registered successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    client.lastCheckIn = new Date().toISOString();
    client.status = 'active';
    clientsDB.set(deviceId, client);

    let decryptedData = {};
    if (encryptedData) {
      decryptedData = decryptData(encryptedData, client.encryptionKey);
    }

    const pendingCommands = client.pendingCommands || [];
    client.pendingCommands = [];
    clientsDB.set(deviceId, client);

    const responseData = { commands: pendingCommands };
    const encryptedResponse = encryptData(responseData, client.encryptionKey);

    res.json({
      success: true,
      encryptedData: encryptedResponse,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clients/report', (req, res) => {
  try {
    const { deviceId, results, logs } = req.body;
    const client = clientsDB.get(deviceId);
    if (client) {
      client.lastReport = new Date().toISOString();
      client.lastResults = results;
      client.lastLogs = logs;
      clientsDB.set(deviceId, client);
    }
    res.json({
      success: true,
      message: 'Report received',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/devices', (req, res) => {
  try {
    const devices = Array.from(clientsDB.values()).map(client => ({
      deviceId: client.deviceId,
      clientId: client.clientId,
      deviceInfo: client.deviceInfo,
      status: client.status,
      registeredAt: client.registeredAt,
      lastCheckIn: client.lastCheckIn,
      lastReport: client.lastReport,
      lastResults: client.lastResults
    }));
    res.json({
      success: true,
      count: devices.length,
      devices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/devices/:deviceId/command', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { type, payload } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, error: 'Command type is required' });
    }
    const client = clientsDB.get(deviceId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    const command = {
      id: 'cmd_' + crypto.randomUUID(),
      type,
      payload: payload || {},
      timestamp: new Date().toISOString()
    };
    if (!client.pendingCommands) {
      client.pendingCommands = [];
    }
    client.pendingCommands.push(command);
    clientsDB.set(deviceId, client);
    res.json({
      success: true,
      command,
      message: 'Command queued successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/devices/:deviceId/commands', (req, res) => {
  try {
    const { deviceId } = req.params;
    const client = clientsDB.get(deviceId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    const commands = commandsDB.get(deviceId) || [];
    res.json({
      success: true,
      commands,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/devices/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!clientsDB.has(deviceId)) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    clientsDB.delete(deviceId);
    commandsDB.delete(deviceId);
    res.json({
      success: true,
      message: 'Device removed successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('Device Tracker Server running on port ' + PORT);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Error:', error);
});

module.exports = app;
