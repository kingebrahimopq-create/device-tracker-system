import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ============================================
// Server Configuration
// ============================================

app.use(cors({ origin: '*' }));
app.use(express.json());

// Database interface
interface Client {
  deviceId: string;
  clientId: string;
  encryptionKey: string;
  deviceInfo: any;
  registeredAt: Date;
  lastCheckIn?: Date;
}

const clientsDB = new Map<string, Client>();

// ============================================
// Encryption Functions (AES-256-CBC)
// ============================================

function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function encryptData(data: any, key: string): string {
  try {
    const algorithm = 'aes-256-cbc';
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return iv.toString('hex') + ':' + encrypted;
  } catch (error: any) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

function decryptData(encryptedData: string, key: string): any {
  try {
    const algorithm = 'aes-256-cbc';
    const keyBuffer = Buffer.from(key, 'hex');
    const parts = encryptedData.split(':');

    if (parts.length < 2) throw new Error('Invalid encrypted data format');

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts.length === 3 ? parts[2] : parts[1];

    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error: any) {
    console.error('Decryption error:', error.message);
    // Try simple Base64 decoding for backward compatibility
    try {
      return JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
    } catch (e) {
      throw new Error('Failed to decrypt data');
    }
  }
}

// ============================================
// API Routes
// ============================================

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Server is running successfully',
    version: '2.0.0',
    timestamp: new Date(),
    endpoints: {
      register: 'POST /api/clients/register',
      checkin: 'POST /api/clients/checkin',
      report: 'POST /api/clients/report',
      devices: 'GET /api/devices'
    }
  });
});

// Register new device
app.post('/api/clients/register', (req: Request, res: Response) => {
  try {
    const { clientId, deviceInfo } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId is required' });
    }

    const deviceId = crypto.randomUUID();
    const encryptionKey = generateEncryptionKey();

    const client: Client = {
      deviceId,
      clientId,
      encryptionKey,
      deviceInfo,
      registeredAt: new Date(),
    };

    clientsDB.set(deviceId, client);

    console.log(`✅ New device registered: ${deviceId}`);
    console.log(`📱 Client ID: ${clientId}`);
    console.log(`🔐 Encryption key: ${encryptionKey.substring(0, 16)}...`);

    res.json({
      success: true,
      deviceId,
      encryptionKey,
      message: 'Device registered successfully',
      timestamp: new Date(),
    });
  } catch (error: any) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Device check-in
app.post('/api/clients/checkin', (req: Request, res: Response) => {
  try {
    const { deviceId, encryptedData } = req.body;

    if (!deviceId || !encryptedData) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const client = clientsDB.get(deviceId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Device not registered' });
    }

    // Decrypt incoming data
    let decrypted;
    try {
      decrypted = decryptData(encryptedData, client.encryptionKey);
    } catch (decryptError) {
      console.warn('⚠️ Decryption failed, attempting Base64 fallback');
      try {
        decrypted = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
      } catch (e) {
        throw decryptError;
      }
    }

    console.log(`📡 Check-in from: ${deviceId}`, decrypted);

    // Update last check-in
    client.lastCheckIn = new Date();
    clientsDB.set(deviceId, client);

    // Prepare response
    const responseData = { commands: [], timestamp: new Date() };
    let encryptedResponse;
    try {
      encryptedResponse = encryptData(responseData, client.encryptionKey);
    } catch (encryptError) {
      // Fallback to Base64
      encryptedResponse = Buffer.from(JSON.stringify(responseData)).toString('base64');
    }

    res.json({
      success: true,
      encryptedData: encryptedResponse,
      timestamp: new Date(),
    });
  } catch (error: any) {
    console.error('❌ Check-in error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send report
app.post('/api/clients/report', (req: Request, res: Response) => {
  try {
    const { deviceId, type, data } = req.body;
    console.log(`📊 Report from: ${deviceId}`, { type, data });
    res.json({ 
      success: true, 
      message: 'Report received successfully',
      timestamp: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all devices
app.get('/api/devices', (req: Request, res: Response) => {
  const devices = Array.from(clientsDB.values()).map(c => ({
    deviceId: c.deviceId,
    clientId: c.clientId,
    deviceInfo: c.deviceInfo,
    status: c.lastCheckIn ? 'active' : 'inactive',
    lastCheckIn: c.lastCheckIn,
    registeredAt: c.registeredAt,
  }));
  
  res.json({ 
    success: true, 
    count: devices.length, 
    devices,
    timestamp: new Date()
  });
});

// ============================================
// Error Handling
// ============================================

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Unexpected error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Server error',
    message: err.message 
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, HOST as string, () => {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  🖥️  Device Tracker Server');
  console.log('════════════════════════════════════════');
  console.log(`  ✅ Server is running successfully`);
  console.log(`  🌐 Address: http://${HOST}:${PORT}`);
  console.log(`  📡 Local:   http://localhost:${PORT}`);
  console.log(`  📊 Stats:   GET http://localhost:${PORT}/api/devices`);
  console.log('════════════════════════════════════════');
  console.log('');
});
