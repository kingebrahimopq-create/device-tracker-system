import crypto from 'crypto';

/**
 * نظام التشفير الموحد للاتصالات الآمنة
 * تم التبديل إلى AES-256-CBC لضمان التوافق مع React Native (CryptoJS)
 */
export class EncryptionService {
  private algorithm = 'aes-256-cbc';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits

  /**
   * توليد مفتاح تشفير عشوائي فريد
   */
  generateKey(): string {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  /**
   * توليد معرف فريد للجهاز (UUID)
   */
  generateDeviceId(): string {
    return crypto.randomUUID();
  }

  /**
   * تشفير البيانات
   * @param data البيانات المراد تشفيرها
   * @param key المفتاح السري (hex)
   * @returns البيانات المشفرة بتنسيق IV:Data
   */
  encrypt(data: string, key: string): string {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const iv = crypto.randomBytes(this.ivLength);

      const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, iv);
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // دمج IV والبيانات المشفرة
      const result = iv.toString('hex') + ':' + encrypted;
      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('فشل في تشفير البيانات');
    }
  }

  /**
   * فك تشفير البيانات
   * @param encryptedData البيانات المشفرة بتنسيق IV:Data
   * @param key المفتاح السري (hex)
   * @returns البيانات الأصلية
   */
  decrypt(encryptedData: string, key: string): string {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const parts = encryptedData.split(':');

      if (parts.length < 2) {
        throw new Error('صيغة البيانات المشفرة غير صحيحة');
      }

      const iv = Buffer.from(parts[0], 'hex');
      // في حال وجود Tag (من إصدارات سابقة)، نأخذ الجزء الأخير كبيانات مشفرة
      const encrypted = parts[parts.length - 1];

      const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, iv);

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('فشل في فك تشفير البيانات');
    }
  }

  /**
   * توليد توقيع رقمي HMAC
   */
  generateSignature(data: string, key: string): string {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * التحقق من التوقيع الرقمي
   */
  verifySignature(data: string, signature: string, key: string): boolean {
    const expectedSignature = this.generateSignature(data, key);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * توليد hash SHA-256
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export const encryptionService = new EncryptionService();
