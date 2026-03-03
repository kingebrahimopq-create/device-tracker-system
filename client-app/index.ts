import ClientService from './client-service';
import os from 'os';

/**
 * نقطة دخول تطبيق العميل
 * يتم تشغيل هذا التطبيق على الجهاز المراد تتبعه
 */

// الحصول على معلومات الجهاز من متغيرات البيئة
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const CLIENT_ID = process.env.CLIENT_ID || 'client_' + Date.now();
const DEVICE_ID = process.env.DEVICE_ID;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const CHECK_IN_INTERVAL = parseInt(process.env.CHECK_IN_INTERVAL || '30', 10);

console.log(`╔════════════════════════════════════════╗
║ Device Tracker - Client Application ║
║ تطبيق العميل - متتبع الأجهزة ║
╚════════════════════════════════════════╝`);

/**
 * الحصول على معلومات النظام
 */
function getSystemInfo() {
  return {
    deviceName: os.hostname(),
    osType: os.type(),
    osVersion: os.release(),
    platform: process.platform,
    arch: os.arch(),
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    timestamp: new Date(),
  };
}

/**
 * تهيئة وبدء العميل
 */
async function initializeClient() {
  try {
    console.log(`📍 الخادم: ${SERVER_URL}`);
    console.log(`🔑 معرف العميل: ${CLIENT_ID}`);
    console.log(`⏱️ فترة الاتصال: ${CHECK_IN_INTERVAL} ثانية\n`);

    // إنشاء خدمة العميل
    const client = new ClientService({
      serverUrl: SERVER_URL,
      clientId: CLIENT_ID,
      deviceId: DEVICE_ID,
      encryptionKey: ENCRYPTION_KEY,
      checkInInterval: CHECK_IN_INTERVAL,
    });

    // إذا لم يكن لدينا معرف جهاز أو مفتاح تشفير، نسجل الجهاز
    if (!DEVICE_ID || !ENCRYPTION_KEY) {
      console.log('📝 تسجيل الجهاز لدى الخادم...');
      const systemInfo = getSystemInfo();
      await client.register(systemInfo);
      console.log(`✅ تم التسجيل بنجاح!\n`);
      console.log(`معرف الجهاز: ${client.getDeviceId()}`);
      console.log(`مفتاح التشفير: ${client.getEncryptionKey()}\n`);
    }

    // بدء خدمة الاتصال الدورية
    client.startCheckInService(getSystemInfo);

    // معالجة إشارات الإيقاف
    process.on('SIGINT', () => {
      console.log('\n\n⏹️ إيقاف تطبيق العميل...');
      client.stopCheckInService();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\n⏹️ إيقاف تطبيق العميل...');
      client.stopCheckInService();
      process.exit(0);
    });

    console.log('🚀 تطبيق العميل يعمل بنجاح');
    console.log('💡 اضغط Ctrl+C للإيقاف\n');
  } catch (error) {
    console.error('❌ فشل في تهيئة العميل:', error);
    process.exit(1);
  }
}

// بدء التطبيق
initializeClient();
