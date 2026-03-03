const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const clientsDB = new Map();
const commandsQueue = new Map();

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

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Device Tracker Server v2.0',
        timestamp: new Date().toISOString()
    });
});

// Register device
app.post('/api/clients/register', (req, res) => {
    try {
        const { clientId, deviceInfo } = req.body;
        if (!clientId) {
            return res.status(400).json({ success: false, error: 'clientId required' });
        }
        
        const deviceId = 'device_' + crypto.randomUUID();
        const encryptionKey = generateEncryptionKey();        
        clientsDB.set(deviceId, {
            deviceId,
            clientId,
            encryptionKey,
            deviceInfo: deviceInfo || {},
            registeredAt: new Date().toISOString(),
            status: 'active'
        });
        
        commandsQueue.set(deviceId, []);
        
        console.log('✅ New device registered:', deviceId);
        
        res.json({ 
            success: true, 
            deviceId, 
            encryptionKey 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Check-in from device
app.post('/api/clients/checkin', (req, res) => {
    try {
        const { deviceId, encryptedData } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ success: false, error: 'deviceId required' });
        }
        
        const client = clientsDB.get(deviceId);
        if (!client) {
            return res.status(404).json({ success: false, error: 'Device not found' });
        }
        
        // Update last check-in
        client.lastCheckIn = new Date().toISOString();
        client.status = 'active';
        clientsDB.set(deviceId, client);
        
        // Get pending commands
        const pendingCommands = commandsQueue.get(deviceId) || [];
        if (pendingCommands.length > 0) {
            commandsQueue.set(deviceId, []);        }
        
        const responseData = { commands: pendingCommands };
        const encryptedResponse = encryptData(responseData, client.encryptionKey);
        
        res.json({ 
            success: true, 
            encryptedData: encryptedResponse 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get all devices
app.get('/api/devices', (req, res) => {
    try {
        const devices = Array.from(clientsDB.values()).map(c => ({
            deviceId: c.deviceId,
            clientId: c.clientId,
            status: c.status,
            registeredAt: c.registeredAt,
            lastCheckIn: c.lastCheckIn,
            isOnline: c.lastCheckIn && (Date.now() - new Date(c.lastCheckIn).getTime()) < 60000
        }));
        
        res.json({ 
            success: true, 
            count: devices.length, 
            devices 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Send command to device
app.post('/api/devices/:deviceId/command', (req, res) => {
    try {
        const { deviceId } = req.params;
        const { type, action, payload } = req.body;
        
        const client = clientsDB.get(deviceId);
        if (!client) {            return res.status(404).json({ success: false, error: 'Device not found' });
        }
        
        const command = {
            id: 'cmd_' + crypto.randomUUID(),
            type: type || 'custom',
            action: action || null,
            payload: payload || {},
            createdAt: new Date().toISOString()
        };
        
        if (!commandsQueue.has(deviceId)) {
            commandsQueue.set(deviceId, []);
        }
        
        commandsQueue.get(deviceId).push(command);
        
        res.json({ 
            success: true, 
            command, 
            message: 'Command queued' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('════════════════════════════════════════');
    console.log('  🖥️  Device Tracker Server v2.0');
    console.log('════════════════════════════════════════');
    console.log(`  ✅ Server running on port ${PORT}`);
    console.log(`  🌐 Address: http://0.0.0.0:${PORT}`);
    console.log(`  📡 Local: http://localhost:${PORT}`);
    console.log('════════════════════════════════════════');
});

module.exports = app;