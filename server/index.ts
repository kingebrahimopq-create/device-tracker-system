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
  return iv.toString('hex') + ':' + encrypted;
}

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