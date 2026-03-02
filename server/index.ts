import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';

// تحميل المتغيرات البيئية
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // ✅ للاستماع على جميع الشبكات

// ============================================
// ⚙️ إعدادات الخادم
// ============================================

app.use(cors({ origin: '*' })); // ✅ السماح بالاتصال من أي مكان (للتطوير)
app.use(express.json());

// قاعدة بيانات مؤقتة (في الذاكرة)
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
// 🔐 دوال التشفير (AES-256-CBC)
// ============================================

function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex'); // 32 بايت = 256 بت
}

function encryptData(data: any, key: string): string {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // ✅ الصيغة: iv:encrypted (بدون tag)
  return iv.toString('hex') + ':' + encrypted;}

function decryptData(encryptedData: string, key: string): any {
  const algorithm = 'aes-256-cbc';
  const keyBuffer = Buffer.from(key, 'hex');
  const parts = encryptedData.split(':');

  if (parts.length < 2) throw new Error('صيغة غير صالحة');

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts.length === 3 ? parts[2] : parts[1];

  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// ============================================
// 🛣️ المسارات (API Routes)
// ============================================

// صفحة رئيسية
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '🖥️ الخادم يعمل بنجاح',
    timestamp: new Date(),
  });
});

// تسجيل جهاز جديد
app.post('/api/clients/register', (req: Request, res: Response) => {
  try {
    const { clientId, deviceInfo } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId مطلوب' });
    }

    const deviceId = crypto.randomUUID();
    const encryptionKey = generateEncryptionKey();

    const client: Client = {
      deviceId,
      clientId,
      encryptionKey,
      deviceInfo,
      registeredAt: new Date(),    };

    clientsDB.set(deviceId, client);

    console.log(`✅ جهاز جديد: ${deviceId}`);

    res.json({
      success: true,
      deviceId,
      encryptionKey,
      message: 'تم التسجيل بنجاح',
    });
  } catch (error: any) {
    console.error('❌ خطأ في التسجيل:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// تسجيل الدخول (Check-in)
app.post('/api/clients/checkin', (req: Request, res: Response) => {
  try {
    const { deviceId, encryptedData } = req.body;

    if (!deviceId || !encryptedData) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }

    const client = clientsDB.get(deviceId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'الجهاز غير مسجل' });
    }

    // فك تشفير البيانات الواردة
    const decrypted = decryptData(encryptedData, client.encryptionKey);
    console.log(`📡 Check-in من: ${deviceId}`, decrypted);

    // تحديث آخر اتصال
    client.lastCheckIn = new Date();
    clientsDB.set(deviceId, client);

    // تجهيز رد (مثلاً أوامر فارغة حالياً)
    const responseData = { commands: [] };
    const encryptedResponse = encryptData(responseData, client.encryptionKey);

    res.json({
      success: true,
      encryptedData: encryptedResponse,
    });
  } catch (error: any) {
    console.error('❌ خطأ في check-in:', error);    res.status(500).json({ success: false, error: error.message });
  }
});

// إرسال تقرير
app.post('/api/clients/report', (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    console.log(`📊 تقرير من: ${deviceId}`);
    res.json({ success: true, message: 'تم استلام التقرير' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب جميع الأجهزة
app.get('/api/devices', (req: Request, res: Response) => {
  const devices = Array.from(clientsDB.values()).map(c => ({
    deviceId: c.deviceId,
    clientId: c.clientId,
    status: c.lastCheckIn ? 'active' : 'inactive',
    lastCheckIn: c.lastCheckIn,
  }));
  res.json({ success: true, count: devices.length, devices });
});

// ============================================
// 🚀 تشغيل الخادم
// ============================================

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  🖥️  الخادم يعمل بنجاح');
  console.log('════════════════════════════════════════');
  console.log(`  🌐 العنوان: http://${HOST}:${PORT}`);
  console.log(`  📡 محلي:     http://localhost:${PORT}`);
  console.log('════════════════════════════════════════');
  console.log('');
});