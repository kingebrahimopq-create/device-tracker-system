import express, { Request, Response } from 'express';
import cors from 'cors';
import { encryptionService } from './encryption';
import { Device, Command, CommandType, Log, isSafeCommand, ClientCheckInRequest, ServerResponse } from './models';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// قاعدة بيانات مؤقتة (في الإنتاج يجب استخدام قاعدة بيانات حقيقية)
const devices = new Map<string, Device>();
const commands = new Map<string, Command[]>();
const logs = new Map<string, Log[]>();
const clientKeys = new Map<string, string>(); // معرف العميل -> مفتاح التشفير

/**
 * POST /api/clients/register
 * تسجيل عميل جديد
 */
app.post('/api/clients/register', (req: Request, res: Response) => {
  try {
    const { clientId, deviceInfo, encryptedData } = req.body;

    if (!clientId || !deviceInfo) {
      return res.status(400).json({ error: 'معرف العميل ومعلومات الجهاز مطلوبة' });
    }

    // توليد مفتاح تشفير فريد للجهاز
    const encryptionKey = encryptionService.generateKey();
    const deviceId = encryptionService.generateDeviceId();

    // إنشاء جهاز جديد
    const device: Device = {
      id: deviceId,
      name: deviceInfo.deviceName || 'جهاز جديد',
      clientId,
      encryptionKey,
      status: 'online',
      lastSeen: new Date(),
      createdAt: new Date(),
      osType: deviceInfo.osType,
      osVersion: deviceInfo.osVersion,
      appVersion: deviceInfo.appVersion,
    };

    devices.set(deviceId, device);
    clientKeys.set(clientId, encryptionKey);
    commands.set(deviceId, []);
    logs.set(deviceId, []);

    console.log(`✓ تم تسجيل جهاز جديد: ${deviceId}`);

    res.json({
      success: true,
      deviceId,
      encryptionKey,
      message: 'تم التسجيل بنجاح',
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'فشل في التسجيل' });
  }
});

/**
 * POST /api/clients/checkin
 * تحديث حالة العميل واستقبال الأوامر
 */
app.post('/api/clients/checkin', (req: Request, res: Response) => {
  try {
    const { deviceId, encryptedData } = req.body;

    if (!deviceId || !encryptedData) {
      return res.status(400).json({ error: 'معرف الجهاز والبيانات المشفرة مطلوبة' });
    }

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'الجهاز غير موجود' });
    }

    // فك تشفير البيانات
    let decryptedData;
    try {
      decryptedData = JSON.parse(encryptionService.decrypt(encryptedData, device.encryptionKey));
    } catch (error) {
      return res.status(400).json({ error: 'فشل في فك تشفير البيانات' });
    }

    // تحديث معلومات الجهاز
    device.status = 'online';
    device.lastSeen = new Date();
    if (decryptedData.location) {
      device.location = decryptedData.location;
    }

    // الحصول على الأوامر المعلقة
    const pendingCommands = (commands.get(deviceId) || []).filter(
      (cmd) => cmd.status === 'pending' && new Date() < cmd.expiresAt
    );

    // تشفير الاستجابة
    const response: ServerResponse = {
      status: 'success',
      commands: pendingCommands,
      timestamp: new Date(),
    };

    const encryptedResponse = encryptionService.encrypt(
      JSON.stringify(response),
      device.encryptionKey
    );

    res.json({
      success: true,
      encryptedData: encryptedResponse,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'فشل في تحديث الحالة' });
  }
});

/**
 * POST /api/clients/report
 * تقرير من العميل (نتائج الأوامر، السجلات، إلخ)
 */
app.post('/api/clients/report', (req: Request, res: Response) => {
  try {
    const { deviceId, encryptedData } = req.body;

    if (!deviceId || !encryptedData) {
      return res.status(400).json({ error: 'معرف الجهاز والبيانات المشفرة مطلوبة' });
    }

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'الجهاز غير موجود' });
    }

    // فك تشفير البيانات
    let decryptedData;
    try {
      decryptedData = JSON.parse(encryptionService.decrypt(encryptedData, device.encryptionKey));
    } catch (error) {
      return res.status(400).json({ error: 'فشل في فك تشفير البيانات' });
    }

    // معالجة التقارير
    if (decryptedData.commandResults) {
      for (const result of decryptedData.commandResults) {
        const deviceCommands = commands.get(deviceId) || [];
        const command = deviceCommands.find((cmd) => cmd.id === result.commandId);
        if (command) {
          command.status = result.status;
          command.result = result.result;
          command.error = result.error;
          command.executedAt = new Date();
        }
      }
    }

    // تسجيل السجلات
    if (decryptedData.logs) {
      const deviceLogs = logs.get(deviceId) || [];
      for (const log of decryptedData.logs) {
        deviceLogs.push({
          id: encryptionService.generateDeviceId(),
          deviceId,
          level: log.level,
          message: log.message,
          timestamp: new Date(log.timestamp),
          metadata: log.metadata,
        });
      }
      logs.set(deviceId, deviceLogs);
    }

    res.json({ success: true, message: 'تم استقبال التقرير' });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'فشل في معالجة التقرير' });
  }
});

/**
 * GET /api/devices
 * الحصول على قائمة الأجهزة
 */
app.get('/api/devices', (req: Request, res: Response) => {
  try {
    const deviceList = Array.from(devices.values()).map((device) => ({
      id: device.id,
      name: device.name,
      status: device.status,
      lastSeen: device.lastSeen,
      osType: device.osType,
      osVersion: device.osVersion,
      location: device.location,
    }));

    res.json(deviceList);
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'فشل في جلب الأجهزة' });
  }
});

/**
 * GET /api/devices/:deviceId
 * الحصول على معلومات جهاز محدد
 */
app.get('/api/devices/:deviceId', (req: Request, res: Response) => {
  try {
    const device = devices.get(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'الجهاز غير موجود' });
    }

    res.json({
      id: device.id,
      name: device.name,
      status: device.status,
      lastSeen: device.lastSeen,
      createdAt: device.createdAt,
      osType: device.osType,
      osVersion: device.osVersion,
      appVersion: device.appVersion,
      location: device.location,
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: 'فشل في جلب معلومات الجهاز' });
  }
});

/**
 * POST /api/commands
 * إرسال أمر إلى جهاز
 */
app.post('/api/commands', (req: Request, res: Response) => {
  try {
    const { deviceId, type, payload } = req.body;

    if (!deviceId || !type || !payload) {
      return res.status(400).json({ error: 'معرف الجهاز ونوع الأمر والبيانات مطلوبة' });
    }

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'الجهاز غير موجود' });
    }

    // التحقق من أمان الأمر
    if (type === CommandType.EXECUTE_SHELL && !isSafeCommand(payload.command)) {
      return res.status(403).json({ error: 'هذا الأمر محظور لأسباب أمنية' });
    }

    // إنشاء أمر جديد
    const command: Command = {
      id: encryptionService.generateDeviceId(),
      deviceId,
      type,
      payload,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // انتهاء الصلاحية بعد 5 دقائق
    };

    const deviceCommands = commands.get(deviceId) || [];
    deviceCommands.push(command);
    commands.set(deviceId, deviceCommands);

    console.log(`✓ تم إنشاء أمر جديد: ${command.id}`);

    res.json({
      success: true,
      commandId: command.id,
      message: 'تم إرسال الأمر',
    });
  } catch (error) {
    console.error('Create command error:', error);
    res.status(500).json({ error: 'فشل في إرسال الأمر' });
  }
});

/**
 * GET /api/commands/:deviceId
 * الحصول على أوامر جهاز
 */
app.get('/api/commands/:deviceId', (req: Request, res: Response) => {
  try {
    const deviceCommands = commands.get(req.params.deviceId) || [];
    res.json(deviceCommands);
  } catch (error) {
    console.error('Get commands error:', error);
    res.status(500).json({ error: 'فشل في جلب الأوامر' });
  }
});

/**
 * GET /api/logs/:deviceId
 * الحصول على سجلات جهاز
 */
app.get('/api/logs/:deviceId', (req: Request, res: Response) => {
  try {
    const deviceLogs = logs.get(req.params.deviceId) || [];
    res.json(deviceLogs);
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'فشل في جلب السجلات' });
  }
});

// بدء الخادم
app.listen(PORT, () => {
  console.log(`\n🚀 خادم Device Tracker يعمل على المنفذ ${PORT}`);
  console.log(`📍 الرابط: http://localhost:${PORT}\n`);
});

export default app;
