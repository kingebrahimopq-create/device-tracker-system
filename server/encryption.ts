import crypto from 'crypto';

/**
 * نظام التشفير المتقدم للاتصالات الآمنة
 * استخدام AES-256-GCM للتشفير والمصادقة
 */

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private tagLength = 16; // 128 bits

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
   * @param key المفتاح السري
   * @returns البيانات المشفرة مع IV و Tag
   */
  encrypt(data: string, key: string): string {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // دمج IV و Tag والبيانات المشفرة
      const result = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('فشل في تشفير البيانات');
    }
  }

  /**
   * فك تشفير البيانات
   * @param encryptedData البيانات المشفرة
   * @param key المفتاح السري
   * @returns البيانات الأصلية
   */
  decrypt(encryptedData: string, key: string): string {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const parts = encryptedData.split(':');
      
      if (parts.length !== 3) {
        throw new Error('صيغة البيانات المشفرة غير صحيحة');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('فشل في فك تشفير البيانات');
    }
  }

  /**
   * توليد توقيع رقمي HMAC
   * @param data البيانات
   * @param key المفتاح السري
   */
  generateSignature(data: string, key: string): string {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * التحقق من التوقيع الرقمي
   * @param data البيانات
   * @param signature التوقيع
   * @param key المفتاح السري
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
   * @param data البيانات
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export const encryptionService = new EncryptionService();
