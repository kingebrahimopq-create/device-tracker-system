const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory databases
const clientsDB = new Map();
const commandsQueue = new Map();

// Generate encryption key
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

// Encrypt data
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
        console.error('Encryption error:', error);
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Device Tracker Server v2.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Register new device
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
        
        const clientData = {
            deviceId,
            clientId,
            encryptionKey,
            deviceInfo: deviceInfo || {},
            registeredAt: new Date().toISOString(),
            lastCheckIn: null,
            status: 'active'
        };
        
        clientsDB.set(deviceId, clientData);
        commandsQueue.set(deviceId, []);
        
        console.log('✅ New device registered:', deviceId);
        console.log('   Client ID:', clientId);
        
        res.json({ 
            success: true, 
            deviceId, 
            encryptionKey,
            message: 'Device registered successfully'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Device check-in
app.post('/api/clients/checkin', (req, res) => {
    try {
        const { deviceId, encryptedData } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ 
                success: false,                 error: 'deviceId is required' 
            });
        }
        
        const client = clientsDB.get(deviceId);
        
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                error: 'Device not found' 
            });
        }
        
        // Update last check-in time
        client.lastCheckIn = new Date().toISOString();
        client.status = 'active';
        clientsDB.set(deviceId, client);
        
        // Get pending commands
        const pendingCommands = commandsQueue.get(deviceId) || [];
        
        // Clear the queue after retrieving
        if (pendingCommands.length > 0) {
            commandsQueue.set(deviceId, []);
        }
        
        // Prepare response
        const responseData = { 
            commands: pendingCommands,
            timestamp: new Date().toISOString()
        };
        
        // Encrypt response
        const encryptedResponse = encryptData(responseData, client.encryptionKey);
        
        res.json({ 
            success: true, 
            encryptedData: encryptedResponse,
            commandCount: pendingCommands.length
        });
        
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
// Get all devices
app.get('/api/devices', (req, res) => {
    try {
        const devices = Array.from(clientsDB.values()).map(client => ({
            deviceId: client.deviceId,
            clientId: client.clientId,
            status: client.status,
            registeredAt: client.registeredAt,
            lastCheckIn: client.lastCheckIn,
            isOnline: client.lastCheckIn && (Date.now() - new Date(client.lastCheckIn).getTime()) < 60000,
            deviceInfo: client.deviceInfo
        }));
        
        res.json({ 
            success: true, 
            count: devices.length, 
            devices,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Get devices error:', error);
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
        
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                error: 'Device not found' 
            });
        }
        
        const command = {
            id: 'cmd_' + crypto.randomUUID(),
            type: type || 'custom',
            action: action || null,
            payload: payload || {},
            createdAt: new Date().toISOString(),            status: 'pending'
        };
        
        // Initialize queue if not exists
        if (!commandsQueue.has(deviceId)) {
            commandsQueue.set(deviceId, []);
        }
        
        // Add command to queue
        commandsQueue.get(deviceId).push(command);
        
        console.log(`📤 Command queued for ${deviceId}:`, command.id);
        
        res.json({ 
            success: true, 
            command, 
            message: 'Command queued successfully',
            queueLength: commandsQueue.get(deviceId).length
        });
        
    } catch (error) {
        console.error('Send command error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get device status
app.get('/api/devices/:deviceId/status', (req, res) => {
    try {
        const { deviceId } = req.params;
        
        const client = clientsDB.get(deviceId);
        
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                error: 'Device not found' 
            });
        }
        
        const queueLength = (commandsQueue.get(deviceId) || []).length;
        
        res.json({
            success: true,
            device: {
                deviceId: client.deviceId,
                clientId: client.clientId,                status: client.status,
                registeredAt: client.registeredAt,
                lastCheckIn: client.lastCheckIn,
                isOnline: client.lastCheckIn && (Date.now() - new Date(client.lastCheckIn).getTime()) < 60000,
                pendingCommands: queueLength
            }
        });
        
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════════════');
    console.log('   🖥️  Device Tracker Server v2.0');
    console.log('═══════════════════════════════════════════════');
    console.log(`   ✅ Server running successfully`);
    console.log(`   🌐 Address: http://0.0.0.0:${PORT}`);
    console.log(`   📡 Local:   http://localhost:${PORT}`);
    console.log(`   🕐 Started: ${new Date().toLocaleString()}`);
    console.log('═══════════════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(' SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

module.exports = app;